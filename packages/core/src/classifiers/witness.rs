use crate::types::{
    ScriptType, TaprootSpendType, WitnessItemAnalysis, WitnessItemParsed, WitnessItemType, WitnessType,
};

pub fn is_likely_schnorr_signature(data: &[u8]) -> bool {
    data.len() == 64 || data.len() == 65
}

pub fn is_likely_control_block(data: &[u8]) -> bool {
    data.len() >= 33 && (data.len() - 33) % 32 == 0
}

pub fn is_likely_der_signature(data: &[u8]) -> bool {
    data.len() > 8 && data[0] == 0x30
}

pub fn classify_witness(witness: &[Vec<u8>]) -> (Option<WitnessType>, ScriptType) {
    if witness.is_empty() {
        return (None, ScriptType::NonStandard);
    }

    if witness.len() == 1 && is_likely_schnorr_signature(&witness[0]) {
        return (Some(WitnessType::P2TRKeyPath), ScriptType::P2TR);
    }

    if witness.len() > 1 && is_likely_control_block(&witness[witness.len() - 1]) {
        return (Some(WitnessType::P2TRScriptPath), ScriptType::P2TR);
    }

    if witness.len() == 2 && is_likely_der_signature(&witness[0]) && crate::utils::crypto::is_pubkey(&witness[1]) {
        return (Some(WitnessType::P2WPKH), ScriptType::P2WPKH);
    }

    let last = &witness[witness.len() - 1];
    let leaf_script = bitcoin::Script::from_bytes(last);
    let leaf_type = crate::classifiers::script::classify_script(leaf_script);

    if !matches!(leaf_type, ScriptType::NonStandard) {
        return (Some(WitnessType::P2WSH), ScriptType::P2WSH);
    }

    (Some(WitnessType::Unknown), ScriptType::NonStandard)
}

pub fn classify_witness_item(
    bytes: &[u8],
    index: usize,
    total_len: usize,
    last_is_control_block: bool,
) -> WitnessItemType {
    if bytes.is_empty() {
        return WitnessItemType::Unknown;
    }

    if bytes[0] == 0x50 {
        return WitnessItemType::Annex;
    }

    if total_len > 1 {
        if index == total_len - 1 && is_likely_control_block(bytes) {
            return WitnessItemType::ControlBlock;
        }
        if index == total_len - 2 && last_is_control_block {
            return WitnessItemType::Tapscript;
        }
    }

    if is_likely_schnorr_signature(bytes) {
        let spend_type = if last_is_control_block {
            TaprootSpendType::ScriptPath
        } else {
            TaprootSpendType::KeyPath
        };
        return WitnessItemType::SchnorrSignature { spend_type };
    }

    if is_likely_der_signature(bytes) {
        return WitnessItemType::DerSignature;
    }

    if bytes.len() == 33 && (bytes[0] == 0x02 || bytes[0] == 0x03) {
        return WitnessItemType::CompressedPubkey;
    }

    if bytes.len() == 65 && bytes[0] == 0x04 {
        return WitnessItemType::UncompressedPubkey;
    }

    let script = bitcoin::Script::from_bytes(bytes);
    if script.instructions().next().is_some() {
        return WitnessItemType::Tapscript;
    }

    WitnessItemType::Unknown
}

pub fn parse_witness_item(bytes: &[u8], item_type: &WitnessItemType) -> WitnessItemParsed {
    match item_type {
        WitnessItemType::DerSignature => {
            parse_der_signature(bytes).unwrap_or(WitnessItemParsed::Raw { hex: hex::encode(bytes) })
        }
        WitnessItemType::SchnorrSignature { .. } => {
            parse_schnorr_signature(bytes).unwrap_or(WitnessItemParsed::Raw { hex: hex::encode(bytes) })
        }
        WitnessItemType::CompressedPubkey | WitnessItemType::UncompressedPubkey => {
            parse_pubkey(bytes).unwrap_or(WitnessItemParsed::Raw { hex: hex::encode(bytes) })
        }
        WitnessItemType::ControlBlock => {
            parse_control_block(bytes).unwrap_or(WitnessItemParsed::Raw { hex: hex::encode(bytes) })
        }
        WitnessItemType::Tapscript => {
            parse_tapscript(bytes).unwrap_or(WitnessItemParsed::Raw { hex: hex::encode(bytes) })
        }
        _ => WitnessItemParsed::Raw { hex: hex::encode(bytes) },
    }
}

pub fn analyze_witness(witness: &[Vec<u8>]) -> Vec<WitnessItemAnalysis> {
    if witness.is_empty() {
        return Vec::new();
    }

    let last_is_cb = is_likely_control_block(&witness[witness.len() - 1]);

    witness
        .iter()
        .enumerate()
        .map(|(index, bytes)| {
            let item_type = classify_witness_item(bytes, index, witness.len(), last_is_cb);
            let parsed = parse_witness_item(bytes, &item_type);
            WitnessItemAnalysis {
                index,
                hex: hex::encode(bytes),
                bytes: bytes.len(),
                item_type,
                parsed,
            }
        })
        .collect()
}

fn parse_der_signature(bytes: &[u8]) -> Option<WitnessItemParsed> {
    if bytes.len() < 8 || bytes[0] != 0x30 {
        return None;
    }
    let total_len = bytes[1] as usize;
    if bytes.len() < total_len + 2 {
        return None;
    }

    let mut idx = 2;
    if bytes[idx] != 0x02 {
        return None;
    }
    let r_len = bytes[idx + 1] as usize;
    idx += 2;
    if idx + r_len > bytes.len() {
        return None;
    }
    let r = hex::encode(&bytes[idx..idx + r_len]);
    idx += r_len;

    if bytes[idx] != 0x02 {
        return None;
    }
    let s_len = bytes[idx + 1] as usize;
    idx += 2;
    if idx + s_len > bytes.len() {
        return None;
    }
    let s_slice = &bytes[idx..idx + s_len];
    let s = hex::encode(s_slice);

    let sighash = *bytes.last()?;
    let low_s = is_low_s(s_slice);

    Some(WitnessItemParsed::DerSig {
        r,
        s,
        sighash,
        low_s,
    })
}

fn is_low_s(s_bytes: &[u8]) -> bool {
    let half_order: [u8; 32] = [
        0x7F, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0x5D, 0x57, 0x6E, 0x73, 0x57, 0xA4, 0x50, 0x1D,
        0xDF, 0xE9, 0x2F, 0x46, 0x68, 0x1B, 0x20, 0xA0,
    ];
    let mut s_padded = [0u8; 32];
    if s_bytes.len() > 32 {
        let start = s_bytes.iter().position(|&x| x != 0).unwrap_or(s_bytes.len());
        let s_trimmed = &s_bytes[start..];
        if s_trimmed.len() > 32 {
            return false;
        }
        s_padded[32 - s_trimmed.len()..].copy_from_slice(s_trimmed);
    } else {
        s_padded[32 - s_bytes.len()..].copy_from_slice(s_bytes);
    }
    s_padded < half_order
}

fn parse_schnorr_signature(bytes: &[u8]) -> Option<WitnessItemParsed> {
    if bytes.len() != 64 && bytes.len() != 65 {
        return None;
    }
    let r = hex::encode(&bytes[0..32]);
    let s = hex::encode(&bytes[32..64]);
    let sighash_flag = if bytes.len() == 65 {
        Some(bytes[64])
    } else {
        None
    };
    Some(WitnessItemParsed::SchnorrSig { r, s, sighash_flag })
}

fn parse_pubkey(bytes: &[u8]) -> Option<WitnessItemParsed> {
    if bytes.is_empty() {
        return None;
    }
    let prefix = bytes[0];
    let compressed = prefix == 0x02 || prefix == 0x03;
    let x_coord = if bytes.len() >= 33 {
        hex::encode(&bytes[1..33])
    } else {
        hex::encode(&bytes[1..])
    };
    Some(WitnessItemParsed::Pubkey { prefix, x_coord, compressed })
}

fn parse_control_block(bytes: &[u8]) -> Option<WitnessItemParsed> {
    if bytes.len() < 33 {
        return None;
    }
    let leaf_version = bytes[0] & 0xfe;
    let parity = bytes[0] & 0x01;
    let internal_key = hex::encode(&bytes[1..33]);
    let merkle_depth = (bytes.len() - 33) / 32;
    Some(WitnessItemParsed::ControlBlock {
        leaf_version,
        parity,
        internal_key,
        merkle_depth,
    })
}

fn parse_tapscript(bytes: &[u8]) -> Option<WitnessItemParsed> {
    let script = bitcoin::Script::from_bytes(bytes);
    let asm = crate::utils::script::script_to_asm(script);
    let script_type = crate::classifiers::script::classify_script(script);
    Some(WitnessItemParsed::Tapscript { asm, script_type })
}
