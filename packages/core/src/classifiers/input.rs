use bitcoin::Script;
use crate::types::{ScriptType, WitnessType};

pub fn classify_input(
    script_sig: &Script,
    witness: &[Vec<u8>],
) -> ScriptType {
    if witness.is_empty() && script_sig.is_empty() {
        return ScriptType::NonStandard;
    }

    if !witness.is_empty() && script_sig.is_empty() {
        if witness.len() == 2 {
            return ScriptType::P2WPKH;
        }
        if witness.len() == 1 && crate::classifiers::witness::is_likely_schnorr_signature(&witness[0]) {
            return ScriptType::P2TR;
        }
        if witness.len() > 1 && crate::classifiers::witness::is_likely_control_block(&witness[witness.len() - 1]) {
            return ScriptType::P2TR;
        }
        let last = &witness[witness.len() - 1];
        let last_script = bitcoin::Script::from_bytes(last);
        let last_type = crate::classifiers::script::classify_script(last_script);
        if !matches!(last_type, ScriptType::NonStandard) {
            return ScriptType::P2WSH;
        }
    }

    if !script_sig.is_empty() {
        let script_type = crate::classifiers::script::classify_script(script_sig);
        if !matches!(script_type, ScriptType::NonStandard) {
            return script_type;
        }
    }

    ScriptType::NonStandard
}

pub fn classify_input_script(
    script_sig: &Script,
    witness: &[Vec<u8>],
) -> (ScriptType, Option<WitnessType>) {
    let script_sig_type = crate::classifiers::script::classify_script(script_sig);

    if witness.is_empty() {
        return (script_sig_type, None);
    }

    let (witness_type, witness_script_type) = crate::classifiers::witness::classify_witness(witness);

    if !matches!(witness_script_type, ScriptType::NonStandard) {
        return (witness_script_type, witness_type);
    }

    (script_sig_type, witness_type)
}
