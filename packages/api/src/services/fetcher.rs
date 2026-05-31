use std::time::Duration;
use reqwest::Client;
use bitcoin::consensus::deserialize;
use bitcoin::Transaction;
use bitcoin::hashes::Hash;
use btc_core::types::{
    TxAnalysis, InputAnalysis, OutputAnalysis, ScriptType
};

const PROVIDERS: &[&str] = &[
    "https://mempool.space/api",
    "https://blockstream.info/api",
];

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ProviderPrevout {
    pub scriptpubkey: Option<String>,
    pub scriptpubkey_asm: Option<String>,
    pub value: Option<u64>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ProviderVin {
    pub txid: Option<String>,
    pub vout: Option<u32>,
    pub prevout: Option<ProviderPrevout>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ProviderTx {
    pub fee: Option<u64>,
    pub vin: Option<Vec<ProviderVin>>,
}

pub struct TxFetcher {
    client: Client,
}

impl TxFetcher {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(6))
                .build()
                .unwrap_or_default(),
        }
    }

    async fn fetch_with_fallback<T, F, Fut>(&self, path: &str, parser: F) -> Result<T, anyhow::Error>
    where
        F: Fn(reqwest::Response) -> Fut + Send + Sync,
        Fut: std::future::Future<Output = Result<T, anyhow::Error>> + Send,
    {
        let mut last_error = None;

        for base in PROVIDERS {
            let url = format!("{}{}", base, path);
            match self.client.get(&url).send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        match parser(resp).await {
                            Ok(val) => return Ok(val),
                            Err(e) => last_error = Some(e),
                        }
                    } else {
                        last_error = Some(anyhow::anyhow!("Provider {} returned HTTP {}", base, resp.status()));
                    }
                }
                Err(e) => {
                    last_error = Some(anyhow::anyhow!("Provider {} fetch error: {}", base, e));
                }
            }
        }

        Err(last_error.unwrap_or_else(|| anyhow::anyhow!("All providers failed")))
    }

    pub async fn fetch_raw_hex(&self, txid: &str) -> Result<String, anyhow::Error> {
        let path = format!("/tx/{}/hex", txid);
        self.fetch_with_fallback(&path, |resp| async move {
            let content_type = resp
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|h| h.to_str().ok())
                .unwrap_or("");

            if content_type.contains("application/json") {
                #[derive(serde::Deserialize)]
                struct HexResponse {
                    hex: Option<String>,
                }
                let body = resp.json::<HexResponse>().await?;
                body.hex.ok_or_else(|| anyhow::anyhow!("Hex not found in JSON response"))
            } else {
                let text = resp.text().await?;
                Ok(text.trim().to_string())
            }
        })
        .await
    }

    pub async fn fetch_tx_json(&self, txid: &str) -> Option<ProviderTx> {
        let path = format!("/tx/{}", txid);
        match self.fetch_with_fallback(&path, |resp| async move {
            let tx = resp.json::<ProviderTx>().await?;
            Ok(tx)
        })
        .await
        {
            Ok(tx) => Some(tx),
            Err(_) => None,
        }
    }

    fn decode_address(&self, script_pubkey: &bitcoin::Script) -> Option<String> {
        bitcoin::Address::from_script(script_pubkey, bitcoin::Network::Bitcoin)
            .ok()
            .map(|addr: bitcoin::Address<bitcoin::address::NetworkChecked>| addr.to_string())
            .or_else(|| {
                bitcoin::Address::from_script(script_pubkey, bitcoin::Network::Testnet)
                    .ok()
                    .map(|addr: bitcoin::Address<bitcoin::address::NetworkChecked>| addr.to_string())
            })
    }

    pub async fn fetch_tx_analysis(&self, txid: &str) -> Result<TxAnalysis, anyhow::Error> {
        let hex_str = self.fetch_raw_hex(txid).await?;
        let tx_json = self.fetch_tx_json(txid).await;

        if hex_str.is_empty() || !hex_str.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(anyhow::anyhow!("Unable to decode transaction hex"));
        }

        let tx_bytes = hex::decode(&hex_str)?;
        let tx: Transaction = deserialize(&tx_bytes)?;

        let outputs: Vec<OutputAnalysis> = tx
            .output
            .iter()
            .enumerate()
            .map(|(index, output)| {
                let script_pubkey = &output.script_pubkey;
                let classification = btc_core::classifiers::script::classify_script(script_pubkey);
                let asm = btc_core::utils::script::script_to_asm(script_pubkey);
                let value_sats = output.value.to_sat();

                let mut op_return_decoded = None;
                let mut op_return_protocol = None;

                match &classification {
                    ScriptType::OpReturn { data, protocol } => {
                        op_return_decoded = btc_core::utils::crypto::safe_utf8_decode(data)
                            .or_else(|| Some(hex::encode(data)));
                        op_return_protocol = protocol.clone();
                    }
                    _ => {}
                }

                OutputAnalysis {
                    index: index as u32,
                    values_sats: value_sats,
                    value_btc: format!("{:.8}", (value_sats as f64) / 100_000_000.0),
                    script_pubkey_hex: hex::encode(script_pubkey.as_bytes()),
                    script_pubkey_asm: asm,
                    script_type: classification,
                    address: self.decode_address(script_pubkey),
                    op_return_decoded,
                    op_return_protocol,
                }
            })
            .collect();

        let inputs: Vec<InputAnalysis> = tx
            .input
            .iter()
            .enumerate()
            .map(|(index, input)| {
                let provider_vin = tx_json.as_ref().and_then(|json| json.vin.as_ref()).and_then(|vin| vin.get(index));
                let prevout = provider_vin.and_then(|v| v.prevout.as_ref());
                
                let witness_bytes: Vec<Vec<u8>> = input.witness.iter().map(|w| w.to_vec()).collect();
                let witness: Vec<String> = witness_bytes.iter().map(hex::encode).collect();
                
                let prevout_script_pub_key_hex = prevout.and_then(|p| p.scriptpubkey.clone());
                let prevout_script = prevout_script_pub_key_hex.as_ref()
                    .and_then(|h| hex::decode(h).ok())
                    .map(|bytes| bitcoin::ScriptBuf::from_bytes(bytes));

                let script_sig_hex = hex::encode(input.script_sig.as_bytes());
                let script_sig_asm = btc_core::utils::script::script_to_asm(&input.script_sig);
                
                let (witness_type, witness_script_type) = btc_core::classifiers::witness::classify_witness(&witness_bytes);
                let (mut script_type, _) = btc_core::classifiers::input::classify_input_script(&input.script_sig, &witness_bytes);

                if let Some(prev) = prevout_script.as_ref() {
                    script_type = btc_core::classifiers::script::classify_script(prev);
                }

                if script_type == ScriptType::NonStandard && witness_script_type != ScriptType::NonStandard {
                    script_type = witness_script_type;
                }

                let taproot_detail = if script_type == ScriptType::P2TR {
                    btc_core::taproot::analyze_taproot(&witness)
                } else {
                    None
                };

                let prevout_txid = provider_vin.and_then(|v| v.txid.clone())
                    .unwrap_or_else(|| {
                        let mut hash_bytes = input.previous_output.txid.to_byte_array();
                        hash_bytes.reverse();
                        hex::encode(hash_bytes)
                    });
                let prevout_vout = provider_vin.and_then(|v| v.vout)
                    .unwrap_or(input.previous_output.vout);

                InputAnalysis {
                    index: index as u32,
                    prevout: format!("{}:{}", prevout_txid, prevout_vout),
                    sequence: input.sequence.to_consensus_u32(),
                    script_sig_hex,
                    script_sig_asm,
                    witness,
                    script_type,
                    witness_type,
                    witness_items: Vec::new(), // not used by frontend
                    taproot_detail,
                    prevout_script_pub_key_hex,
                    prevout_script_pub_key_asm: prevout.and_then(|p| p.scriptpubkey_asm.clone()),
                    prevout_value_sats: prevout.and_then(|p| p.value),
                }
            })
            .collect();

        let out_value: u64 = outputs.iter().map(|o| o.values_sats).sum();
        let in_value: u64 = tx_json
            .as_ref()
            .and_then(|json| json.vin.as_ref())
            .map(|vin| vin.iter().filter_map(|v| v.prevout.as_ref()).filter_map(|p| p.value).sum())
            .unwrap_or(0);

        let fee_from_provider = tx_json.as_ref().and_then(|json| json.fee);
        let fee = match fee_from_provider {
            Some(f) => f,
            None => {
                if in_value > 0 {
                    in_value.saturating_sub(out_value)
                } else {
                    0
                }
            }
        };

        let vsize = tx.vsize();

        Ok(TxAnalysis {
            txid: tx.compute_txid().to_string(),
            version: tx.version.0,
            locktime: tx.lock_time.to_consensus_u32(),
            size: tx.total_size(),
            vsize,
            weight: tx.weight().to_wu() as usize,
            fee,
            feerate: if vsize > 0 {
                ((fee as f64) / (vsize as f64) * 100.0).round() / 100.0
            } else {
                0.0
            },
            inputs,
            outputs,
        })
    }
}
