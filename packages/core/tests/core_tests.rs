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
    // We provide: <dummy signature> <dummy pubkey>
    // dummy pubkey = de2d23e1cf0e47087b415a7708c9cd0bde2d23e1 (20 bytes hash is ripe of sha of public key,
    // let's compute hash160 of dummy pubkey)
    let pubkey_hex = "02de2d23e1cf0e47087b415a7708c9cd0bde2d23e17cf0e47087b415a7708c9cd0"; // 33 bytes
    let pubkey_bytes = hex::decode(pubkey_hex).unwrap();
    let hash = btc_core::utils::crypto::hash160(&pubkey_bytes);
    
    // Let's create script: OP_DUP OP_HASH160 <hash> OP_EQUALVERIFY OP_CHECKSIG
    let mut script_bytes = vec![0x76, 0xa9, 20];
    script_bytes.extend_from_slice(&hash);
    script_bytes.extend_from_slice(&[0x88, 0xac]);
    let dynamic_script_hex = hex::encode(&script_bytes);

    let signature_hex = "3044022012345678123456781234567812345678123456781234567812345678123456780220123456781234567812345678123456781234567812345678123456781234567801";

    let witness = vec![signature_hex.to_string(), pubkey_hex.to_string()];
    let steps = debug_script("", &dynamic_script_hex, &witness).unwrap();

    assert!(!steps.is_empty());
    // Check that there were no execution errors
    for step in &steps {
        assert!(step.error.is_none(), "Step failed: {:?}", step.error);
    }
}
