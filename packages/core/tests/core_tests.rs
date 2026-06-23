use btc_core::classifiers::script::classify_script;
use btc_core::types::{ScriptType, OpReturnProtocol};
use btc_core::debugger::engine::debug_script;
use bitcoin::Script;

#[test]
fn test_classify_p2pkh() {
    // Standard P2PKH script: OP_DUP OP_HASH160 <20-byte hash> OP_EQUALVERIFY OP_CHECKSIG
    let p2pkh_hex = "76a914de2d23e1cf0e47087b415a7708c9cd0bde2d23e188ac";
    let p2pkh_bytes = hex::decode(p2pkh_hex).unwrap();
    let script = Script::from_bytes(&p2pkh_bytes);
    let script_type = classify_script(script);
    assert_eq!(script_type, ScriptType::P2PKH);
}

#[test]
fn test_classify_p2sh() {
    // Standard P2SH script: OP_HASH160 <20-byte script-hash> OP_EQUAL
    let p2sh_hex = "a914de2d23e1cf0e47087b415a7708c9cd0bde2d23e187";
    let p2sh_bytes = hex::decode(p2sh_hex).unwrap();
    let script = Script::from_bytes(&p2sh_bytes);
    let script_type = classify_script(script);
    assert_eq!(script_type, ScriptType::P2SH);
}

#[test]
fn test_classify_op_return_omni() {
    // OMNI OP_RETURN: OP_RETURN PUSHDATA("omni"...)
    let omni_hex = "6a146f6d6e690000000000000003000000000de0b6b3";
    let bytes = hex::decode(omni_hex).unwrap();
    let script = Script::from_bytes(&bytes);
    let script_type = classify_script(script);
    
    if let ScriptType::OpReturn { protocol, .. } = script_type {
        assert_eq!(protocol, Some(OpReturnProtocol::OmniLayer));
    } else {
        panic!("Should classify as OP_RETURN");
    }
}

#[test]
fn test_debugger_p2pkh_flow() {
    let pubkey_hex = "02de2d23e1cf0e47087b415a7708c9cd0bde2d23e17cf0e47087b415a7708c9cd0"; // 33 bytes
    let pubkey_bytes = hex::decode(pubkey_hex).unwrap();
    let hash = btc_core::utils::crypto::hash160(&pubkey_bytes);
    
    let mut script_bytes = vec![0x76, 0xa9, 20];
    script_bytes.extend_from_slice(&hash);
    script_bytes.extend_from_slice(&[0x88, 0xac]);
    let dynamic_script_hex = hex::encode(&script_bytes);

    let signature_hex = "3044022012345678123456781234567812345678123456781234567812345678123456780220123456781234567812345678123456781234567812345678123456781234567801";

    // Standard P2PKH scriptSig pushes signature, then public key.
    // Length of signature is 71 bytes (0x47 in hex).
    // Length of public key is 33 bytes (0x21 in hex).
    let script_sig_hex = format!("47{}21{}", signature_hex, pubkey_hex);

    let steps = debug_script(&script_sig_hex, &dynamic_script_hex, &[], None, None, None, None).unwrap();

    assert!(!steps.is_empty());
    let checksig_step = steps.iter().find(|step| step.opcode == "OP_CHECKSIG").unwrap();
    assert_eq!(checksig_step.error, Some(btc_core::types::DebugError::ChecksigSkipped));
}

#[test]
fn test_new_opcodes_flow() {
    let script_hex = "010a826b01146c93";
    let steps = debug_script("", script_hex, &[], None, None, None, None).unwrap();
    assert!(!steps.is_empty());
    
    let last_step = steps.last().unwrap();
    assert!(last_step.error.is_none());
    assert_eq!(last_step.stack_after, vec!["0a".to_string(), "15".to_string()]);
}

#[test]
fn test_op_2rot_flow() {
    let script_hex = "51525354555671";
    let steps = debug_script("", script_hex, &[], None, None, None, None).unwrap();
    assert!(!steps.is_empty());
    
    let last_step = steps.last().unwrap();
    assert!(last_step.error.is_none());
    assert_eq!(
        last_step.stack_after,
        vec![
            "03".to_string(),
            "04".to_string(),
            "05".to_string(),
            "06".to_string(),
            "01".to_string(),
            "02".to_string()
        ]
    );
}

#[test]
fn test_p2sh_redeem_script_flow() {
    let redeem_hex = "5152935387";
    let redeem_bytes = hex::decode(redeem_hex).unwrap();
    let redeem_hash = btc_core::utils::crypto::hash160(&redeem_bytes);
    
    let mut script_pubkey_bytes = vec![0xa9, 20];
    script_pubkey_bytes.extend_from_slice(&redeem_hash);
    script_pubkey_bytes.push(0x87);
    
    let script_pubkey_hex = hex::encode(&script_pubkey_bytes);
    let script_sig_hex = format!("05{}", redeem_hex);
    
    let steps = debug_script(&script_sig_hex, &script_pubkey_hex, &[], None, None, None, None).unwrap();
    assert!(!steps.is_empty());
    
    let transition = steps.iter().find(|s| s.opcode == "P2SH_REDEEM_SCRIPT_EXECUTION");
    assert!(transition.is_some());
    
    let last_step = steps.last().unwrap();
    assert!(last_step.error.is_none());
    assert_eq!(last_step.stack_after, vec!["01".to_string()]);
}

#[test]
fn test_consensus_limits_enforced() {
    let nops_hex = "61".repeat(202);
    let steps1 = debug_script("", &nops_hex, &[], None, None, None, None).unwrap();
    let last_step1 = steps1.last().unwrap();
    assert_eq!(last_step1.error, Some(btc_core::types::DebugError::OpCountExceeded));
    
    let stack_overflow_hex = "51".repeat(1001);
    let steps2 = debug_script("", &stack_overflow_hex, &[], None, None, None, None).unwrap();
    let last_step2 = steps2.last().unwrap();
    assert_eq!(last_step2.error, Some(btc_core::types::DebugError::StackSizeExceeded));
}
