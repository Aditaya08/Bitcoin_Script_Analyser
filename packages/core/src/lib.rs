pub mod types;
pub mod utils;
pub mod classifiers;
pub mod debugger;
pub mod taproot;
#[cfg(target_arch = "wasm32")]
use serde::Serialize;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_classify_script(script_hex: &str) -> Result<JsValue, JsValue> {
    let script_bytes = hex::decode(script_hex)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let script = bitcoin::Script::from_bytes(&script_bytes);
    
    let script_type = crate::classifiers::script::classify_script(script);
    let asm = crate::utils::script::script_to_asm(script);
    
    let mut m = None;
    let mut n = None;
    let mut op_return_hex = None;
    let mut op_return_decoded = None;
    let mut op_return_protocol = None;

    match &script_type {
        crate::types::ScriptType::P2MS { m: m_val, n: n_val } => {
            m = Some(*m_val);
            n = Some(*n_val);
        }
        crate::types::ScriptType::OpReturn { data, protocol } => {
            op_return_hex = Some(hex::encode(data));
            op_return_decoded = crate::utils::crypto::safe_utf8_decode(data)
                .or_else(|| Some(hex::encode(data)));
            op_return_protocol = protocol.clone();
        }
        _ => {}
    }

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct ClassifyResponse {
        script_type: crate::types::ScriptType,
        asm: String,
        m: Option<u8>,
        n: Option<u8>,
        op_return_hex: Option<String>,
        op_return_decoded: Option<String>,
        op_return_protocol: Option<crate::types::OpReturnProtocol>,
    }

    let res = ClassifyResponse {
        script_type,
        asm,
        m,
        n,
        op_return_hex,
        op_return_decoded,
        op_return_protocol,
    };

    serde_wasm_bindgen::to_value(&res)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_debug_script(
    script_sig: &str,
    script_pubkey: &str,
    witness_hex: JsValue,
) -> Result<JsValue, JsValue> {
    let witness_vec: Vec<String> = serde_wasm_bindgen::from_value(witness_hex)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    let steps = crate::debugger::engine::debug_script(script_sig, script_pubkey, &witness_vec)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
    serde_wasm_bindgen::to_value(&steps)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_analyze_taproot(witness_hex: JsValue) -> Result<JsValue, JsValue> {
    let witness_vec: Vec<String> = serde_wasm_bindgen::from_value(witness_hex)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
    let detail = crate::taproot::analyze_taproot(&witness_vec);
    
    serde_wasm_bindgen::to_value(&detail)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}
