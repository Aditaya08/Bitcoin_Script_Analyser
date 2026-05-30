use crate::types::{TaprootDetail, TaprootSpendType, WitnessType};

pub fn analyze_taproot(witness_hex: &[String]) -> Option<TaprootDetail> {
    if witness_hex.is_empty() {
        return None;
    }

    let mut witness = Vec::new();
    for hex_str in witness_hex {
        if let Ok(bytes) = hex::decode(hex_str) {
            witness.push(bytes);
        } else {
            return None;
        }
    }

    let (witness_type, _) = crate::classifiers::witness::classify_witness(&witness);
    let witness_type = witness_type?;

    match witness_type {
        WitnessType::P2TRKeyPath => {
            let signature = &witness[0];
            Some(TaprootDetail {
                spend_type: TaprootSpendType::KeyPath,
                schnorr_sig: Some(hex::encode(signature)),
                internal_key: None,
                control_block: None,
                control_block_depth: None,
                leaf_script_hex: None,
                leaf_script_asm: None,
                leaf_script_type: None,
            })
        }
        WitnessType::P2TRScriptPath => {
            if witness.len() < 2 {
                return None;
            }
            let control_block = &witness[witness.len() - 1];
            let leaf_script = &witness[witness.len() - 2];
            let has_annex = witness.len() > 2 && witness[0].first() == Some(&0x50);
            let sig_index = if has_annex { 1 } else { 0 };
            let signature = &witness[sig_index];

            let internal_key = if control_block.len() >= 33 {
                Some(hex::encode(&control_block[1..33]))
            } else {
                None
            };
            let merkle_depth = if control_block.len() >= 33 {
                Some((control_block.len() - 33) / 32)
            } else {
                None
            };

            let leaf_script_bitcoin = bitcoin::Script::from_bytes(leaf_script);
            let leaf_script_type = crate::classifiers::script::classify_script(leaf_script_bitcoin);

            let schnorr_sig = if signature.len() == 64 || signature.len() == 65 {
                Some(hex::encode(signature))
            } else {
                None
            };

            let leaf_script_bitcoin = bitcoin::Script::from_bytes(leaf_script);
            let leaf_script_asm = crate::utils::script::script_to_asm(leaf_script_bitcoin);

            Some(TaprootDetail {
                spend_type: TaprootSpendType::ScriptPath,
                schnorr_sig,
                internal_key,
                control_block: Some(hex::encode(control_block)),
                control_block_depth: merkle_depth,
                leaf_script_hex: Some(hex::encode(leaf_script)),
                leaf_script_asm: Some(leaf_script_asm),
                leaf_script_type: Some(leaf_script_type),
            })
        }
        _ => None,
    }
}
