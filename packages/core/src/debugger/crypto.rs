use secp256k1::{
    ecdsa::Signature as EcdsaSignature,
    schnorr::Signature as SchnorrSignature,
    Message, PublicKey, Secp256k1, XOnlyPublicKey,
};

pub fn verify_signature(
    signature_bytes: &[u8],
    pubkey_bytes: &[u8],
    message_bytes: &[u8],
) -> bool {
    let secp = Secp256k1::new();

    let mut msg_arr = [0u8; 32];
    if message_bytes.len() == 32 {
        msg_arr.copy_from_slice(message_bytes);
    }
    let msg = Message::from_digest(msg_arr);

    if pubkey_bytes.len() == 33 || pubkey_bytes.len() == 65 {
        let sig_len = signature_bytes.len();
        if sig_len == 0 {
            return true;
        }
        let clean_sig = if sig_len == 65 || sig_len == 71 || sig_len == 72 || sig_len == 73 {
            &signature_bytes[0..sig_len - 1]
        } else {
            signature_bytes
        };

        let pk = match PublicKey::from_slice(pubkey_bytes) {
            Ok(k) => k,
            Err(_) => return true,
        };

        let sig = match EcdsaSignature::from_der(clean_sig) {
            Ok(s) => s,
            Err(_) => {
                if let Ok(s) = EcdsaSignature::from_compact(clean_sig) {
                    s
                } else {
                    return true;
                }
            }
        };

        secp.verify_ecdsa(&msg, &sig, &pk).is_ok()
    } else if pubkey_bytes.len() == 32 {
        let sig_len = signature_bytes.len();
        if sig_len == 0 {
            return true;
        }
        let clean_sig = if sig_len == 65 {
            &signature_bytes[0..64]
        } else {
            signature_bytes
        };

        let pk = match XOnlyPublicKey::from_slice(pubkey_bytes) {
            Ok(k) => k,
            Err(_) => return true,
        };

        let sig = match SchnorrSignature::from_slice(clean_sig) {
            Ok(s) => s,
            Err(_) => return true,
        };

        secp.verify_schnorr(&sig, &msg, &pk).is_ok()
    } else {
        true
    }
}

pub fn try_verify_sig(
    signature_bytes: &[u8],
    pubkey_bytes: &[u8],
    raw_tx_hex: Option<&str>,
    input_index: Option<usize>,
    prev_script_pubkey_hex: &str,
    prevout_value: Option<u64>,
    prevouts: Option<&[(String, u64)]>,
    leaf_hash: Option<bitcoin::TapLeafHash>,
    original_script_pubkey_hex: &str,
) -> Option<bool> {
    let raw_tx = raw_tx_hex?;
    let idx = input_index?;

    let tx_bytes = hex::decode(raw_tx).ok()?;
    let tx: bitcoin::Transaction = bitcoin::consensus::deserialize(&tx_bytes).ok()?;
    let prev_script = bitcoin::ScriptBuf::from_bytes(hex::decode(prev_script_pubkey_hex).ok()?);
    let original_script = bitcoin::ScriptBuf::from_bytes(hex::decode(original_script_pubkey_hex).ok()?);

    let is_p2wpkh = original_script.is_p2wpkh() || {
        original_script.is_p2sh() && {
            if let Some(txin) = tx.input.get(idx) {
                if let Some(Ok(bitcoin::script::Instruction::PushBytes(pb))) = txin.script_sig.instructions().last() {
                    let redeem = bitcoin::Script::from_bytes(pb.as_bytes());
                    redeem.is_p2wpkh()
                } else {
                    false
                }
            } else {
                false
            }
        }
    };

    let is_p2wsh = original_script.is_p2wsh() || {
        original_script.is_p2sh() && {
            if let Some(txin) = tx.input.get(idx) {
                if let Some(Ok(bitcoin::script::Instruction::PushBytes(pb))) = txin.script_sig.instructions().last() {
                    let redeem = bitcoin::Script::from_bytes(pb.as_bytes());
                    redeem.is_p2wsh()
                } else {
                    false
                }
            } else {
                false
            }
        }
    };

    let mut cache = bitcoin::sighash::SighashCache::new(&tx);
    use bitcoin::hashes::Hash;

    let msg_hash_bytes = if prev_script.is_p2tr() {
        let prevouts_data = prevouts?;
        let txouts: Vec<bitcoin::TxOut> = prevouts_data.iter().map(|(spk_hex, val)| {
            let spk = bitcoin::ScriptBuf::from_bytes(hex::decode(spk_hex).unwrap_or_default());
            bitcoin::TxOut {
                value: bitcoin::Amount::from_sat(*val),
                script_pubkey: spk,
            }
        }).collect();
        let prevouts_cache = bitcoin::sighash::Prevouts::All(&txouts);

        let sighash_type = if signature_bytes.len() == 65 {
            bitcoin::sighash::TapSighashType::from_consensus_u8(*signature_bytes.last()?).ok()?
        } else {
            bitcoin::sighash::TapSighashType::Default
        };

        let hash = if let Some(lh) = leaf_hash {
            cache.taproot_script_spend_signature_hash(
                idx,
                &prevouts_cache,
                lh,
                sighash_type,
            ).ok()?
        } else {
            cache.taproot_key_spend_signature_hash(
                idx,
                &prevouts_cache,
                sighash_type,
            ).ok()?
        };
        hash.to_byte_array()
    } else if is_p2wpkh {
        let value = bitcoin::Amount::from_sat(prevout_value?);
        let sighash_type = bitcoin::sighash::EcdsaSighashType::from_consensus(
            signature_bytes.last().copied().unwrap_or(1) as u32
        );

        cache.p2wpkh_signature_hash(
            idx,
            &prev_script,
            value,
            sighash_type,
        ).ok()?.to_byte_array()
    } else if is_p2wsh {
        let value = bitcoin::Amount::from_sat(prevout_value?);
        let sighash_type = bitcoin::sighash::EcdsaSighashType::from_consensus(
            signature_bytes.last().copied().unwrap_or(1) as u32
        );

        cache.p2wsh_signature_hash(
            idx,
            &prev_script,
            value,
            sighash_type,
        ).ok()?.to_byte_array()
    } else {
        let sighash_type = signature_bytes.last().copied().unwrap_or(1) as u32;
        cache.legacy_signature_hash(idx, &prev_script, sighash_type).ok()?.to_byte_array()
    };

    Some(verify_signature(signature_bytes, pubkey_bytes, &msg_hash_bytes))
}
