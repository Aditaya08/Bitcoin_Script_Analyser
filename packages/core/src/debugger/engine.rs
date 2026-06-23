use bitcoin::script::Script;
use crate::types::{DebugError, DebugStep};
use crate::debugger::stack::Stack;
use crate::debugger::script_number;
use crate::debugger::crypto::try_verify_sig;
use crate::utils::crypto::{sha256, hash256, ripemd160, hash160, sha1};

#[derive(Clone, Debug)]
enum OwnedInstruction {
    Op(bitcoin::opcodes::Opcode),
    PushBytes(Vec<u8>),
}

impl<'a> From<bitcoin::script::Instruction<'a>> for OwnedInstruction {
    fn from(ins: bitcoin::script::Instruction<'a>) -> Self {
        match ins {
            bitcoin::script::Instruction::Op(op) => OwnedInstruction::Op(op),
            bitcoin::script::Instruction::PushBytes(pb) => OwnedInstruction::PushBytes(pb.as_bytes().to_vec()),
        }
    }
}

pub fn debug_script(
    script_sig_hex: &str,
    script_pubkey_hex: &str,
    witness_hex: &[String],
    raw_tx_hex: Option<&str>,
    input_index: Option<usize>,
    prevout_value: Option<u64>,
    prevouts: Option<Vec<(String, u64)>>,
) -> Result<Vec<DebugStep>, hex::FromHexError> {
    let mut steps = Vec::new();
    let mut stack = Stack::new();
    let mut alt_stack: Vec<Vec<u8>> = Vec::new();

    let mut script_lifetimes: Vec<bitcoin::ScriptBuf> = Vec::new();
    let mut instructions: Vec<OwnedInstruction> = Vec::new();
    let mut current_script_hex = script_pubkey_hex.to_string();
    let mut taproot_leaf_hash = None;
    let mut is_taproot_keypath = false;

    let pubkey_bytes = if !script_pubkey_hex.is_empty() {
        hex::decode(script_pubkey_hex)?
    } else {
        Vec::new()
    };
    let script_pubkey = Script::from_bytes(&pubkey_bytes);

    if script_pubkey.is_p2wpkh() {
        if witness_hex.len() >= 2 {
            let sig_hex = &witness_hex[0];
            let pubkey_hex = &witness_hex[1];
            for item in &[sig_hex, pubkey_hex] {
                if let Ok(b) = hex::decode(item) {
                    let before = stack.items.clone();
                    stack.push(b);
                    let (s_before, s_after) = diff_stacks(&before, &stack.items);
                    steps.push(DebugStep {
                        step_index: steps.len(),
                        opcode: "WITNESS_PUSH".to_string(),
                        opcode_hex: String::new(),
                        data: Some((*item).clone()),
                        stack_before: s_before,
                        stack_after: s_after,
                        error: None,
                    });
                }
            }
        }
        let keyhash = &pubkey_bytes[2..22];
        let keyhash_pb = <&bitcoin::script::PushBytes>::try_from(keyhash).unwrap();
        let virtual_script = bitcoin::blockdata::script::Builder::new()
            .push_opcode(bitcoin::opcodes::all::OP_DUP)
            .push_opcode(bitcoin::opcodes::all::OP_HASH160)
            .push_slice(keyhash_pb)
            .push_opcode(bitcoin::opcodes::all::OP_EQUALVERIFY)
            .push_opcode(bitcoin::opcodes::all::OP_CHECKSIG)
            .into_script();
        script_lifetimes.push(virtual_script);
        current_script_hex = hex::encode(script_lifetimes.last().unwrap().as_bytes());
        instructions = script_lifetimes.last().unwrap().instructions()
            .collect::<Result<Vec<_>, _>>()
            .unwrap_or_default()
            .into_iter()
            .map(OwnedInstruction::from)
            .collect();
    } else if script_pubkey.is_p2wsh() {
        if !witness_hex.is_empty() {
            let mut witness_items = witness_hex.to_vec();
            let witness_script_hex = witness_items.pop().unwrap_or_default();
            for item in witness_items {
                if let Ok(b) = hex::decode(&item) {
                    let before = stack.items.clone();
                    stack.push(b);
                    let (s_before, s_after) = diff_stacks(&before, &stack.items);
                    steps.push(DebugStep {
                        step_index: steps.len(),
                        opcode: "WITNESS_PUSH".to_string(),
                        opcode_hex: String::new(),
                        data: Some(item),
                        stack_before: s_before,
                        stack_after: s_after,
                        error: None,
                    });
                }
            }
            let witness_script_bytes = hex::decode(&witness_script_hex).unwrap_or_default();
            let witness_script = Script::from_bytes(&witness_script_bytes).to_owned();
            script_lifetimes.push(witness_script);
            current_script_hex = witness_script_hex;
            instructions = script_lifetimes.last().unwrap().instructions()
                .collect::<Result<Vec<_>, _>>()
                .unwrap_or_default()
                .into_iter()
                .map(OwnedInstruction::from)
                .collect();
        }
    } else if script_pubkey.is_p2tr() {
        if witness_hex.len() == 1 {
            let sig_hex = &witness_hex[0];
            if let Ok(b) = hex::decode(sig_hex) {
                let before = stack.items.clone();
                stack.push(b);
                let (s_before, s_after) = diff_stacks(&before, &stack.items);
                steps.push(DebugStep {
                    step_index: steps.len(),
                    opcode: "WITNESS_PUSH".to_string(),
                    opcode_hex: String::new(),
                    data: Some(sig_hex.clone()),
                    stack_before: s_before,
                    stack_after: s_after,
                    error: None,
                });
            }
            is_taproot_keypath = true;
        } else if witness_hex.len() >= 2 {
            let mut witness_items = witness_hex.to_vec();
            let _control_block_hex = witness_items.pop().unwrap_or_default();
            let tapscript_hex = witness_items.pop().unwrap_or_default();
            for item in witness_items {
                if let Ok(b) = hex::decode(&item) {
                    let before = stack.items.clone();
                    stack.push(b);
                    let (s_before, s_after) = diff_stacks(&before, &stack.items);
                    steps.push(DebugStep {
                        step_index: steps.len(),
                        opcode: "WITNESS_PUSH".to_string(),
                        opcode_hex: String::new(),
                        data: Some(item),
                        stack_before: s_before,
                        stack_after: s_after,
                        error: None,
                    });
                }
            }
            let tapscript_bytes = hex::decode(&tapscript_hex).unwrap_or_default();
            let tapscript = Script::from_bytes(&tapscript_bytes).to_owned();
            script_lifetimes.push(tapscript);
            let leaf_hash = bitcoin::TapLeafHash::from_script(script_lifetimes.last().unwrap(), bitcoin::taproot::LeafVersion::TapScript);
            taproot_leaf_hash = Some(leaf_hash);
            current_script_hex = tapscript_hex;
            instructions = script_lifetimes.last().unwrap().instructions()
                .collect::<Result<Vec<_>, _>>()
                .unwrap_or_default()
                .into_iter()
                .map(OwnedInstruction::from)
                .collect();
        }
    } else {
        let sig_bytes = if !script_sig_hex.is_empty() {
            hex::decode(script_sig_hex)?
        } else {
            Vec::new()
        };
        if !sig_bytes.is_empty() {
            let sig_script = Script::from_bytes(&sig_bytes).to_owned();
            script_lifetimes.push(sig_script);
            if let Ok(ins) = script_lifetimes.last().unwrap().instructions().collect::<Result<Vec<_>, _>>() {
                instructions.extend(ins.into_iter().map(OwnedInstruction::from));
            }
        }
        if !pubkey_bytes.is_empty() {
            let pubkey_script = Script::from_bytes(&pubkey_bytes).to_owned();
            script_lifetimes.push(pubkey_script);
            if let Ok(ins) = script_lifetimes.last().unwrap().instructions().collect::<Result<Vec<_>, _>>() {
                instructions.extend(ins.into_iter().map(OwnedInstruction::from));
            }
        }
    }

    let mut if_stack: Vec<bool> = Vec::new();
    let is_p2sh = script_pubkey.is_p2sh();
    let mut p2sh_executed = false;
    let mut pc = 0;
    let mut op_count = 0;

    let sig_instructions_len = if !script_sig_hex.is_empty() {
        if let Ok(sig_bytes) = hex::decode(script_sig_hex) {
            Script::from_bytes(&sig_bytes).instructions().count()
        } else {
            0
        }
    } else {
        0
    };
    let mut p2sh_redeem_script_bytes: Option<Vec<u8>> = None;

    while pc < instructions.len() {
        let instruction = instructions[pc].clone();
        pc += 1;

        let execution_enabled = if_stack.iter().all(|&x| x);
        let stack_before_raw = stack.items.clone();
        let mut error = None;

        let (opcode_name, opcode_hex, pushed_data) = match instruction {
            OwnedInstruction::Op(op) => {
                let op_byte = op.to_u8();
                let op_name = op.to_string();
                let op_hex = hex::encode(&[op_byte]);
                let mut op_data = None;

                if op_byte >= 0x61 {
                    op_count += 1;
                    if op_count > 201 {
                        error = Some(DebugError::OpCountExceeded);
                    }
                }

                if error.is_none() {
                    if op_byte == 0x63 || op_byte == 0x64 { // OP_IF or OP_NOTIF
                        if execution_enabled {
                            if let Some(cond_bytes) = stack.pop() {
                                let cond = is_true(&cond_bytes);
                                let final_cond = if op_byte == 0x63 { cond } else { !cond };
                                if_stack.push(final_cond);
                            } else {
                                error = Some(DebugError::StackEmpty);
                            }
                        } else {
                            if_stack.push(false);
                        }
                    } else if op_byte == 0x67 { // OP_ELSE
                        if let Some(top) = if_stack.last_mut() {
                            *top = !*top;
                        }
                    } else if op_byte == 0x68 { // OP_ENDIF
                        if_stack.pop();
                    } else if execution_enabled {
                        match op_byte {
                            0x00 => stack.push(Vec::new()), // OP_0
                            0x4f => stack.push(script_number::encode(-1)), // OP_1NEGATE
                            0x51 => stack.push(script_number::encode(1)), // OP_1
                            0x52 => stack.push(script_number::encode(2)), // OP_2
                            0x53 => stack.push(script_number::encode(3)), // OP_3
                            0x54 => stack.push(script_number::encode(4)), // OP_4
                            0x55 => stack.push(script_number::encode(5)), // OP_5
                            0x56 => stack.push(script_number::encode(6)), // OP_6
                            0x57 => stack.push(script_number::encode(7)), // OP_7
                            0x58 => stack.push(script_number::encode(8)), // OP_8
                            0x59 => stack.push(script_number::encode(9)), // OP_9
                            0x5a => stack.push(script_number::encode(10)), // OP_10
                            0x5b => stack.push(script_number::encode(11)), // OP_11
                            0x5c => stack.push(script_number::encode(12)), // OP_12
                            0x5d => stack.push(script_number::encode(13)), // OP_13
                            0x5e => stack.push(script_number::encode(14)), // OP_14
                            0x5f => stack.push(script_number::encode(15)), // OP_15
                            0x60 => stack.push(script_number::encode(16)), // OP_16

                            0x6b => { // OP_TOALTSTACK
                                if let Some(val) = stack.pop() {
                                    alt_stack.push(val);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x6c => { // OP_FROMALTSTACK
                                if let Some(val) = alt_stack.pop() {
                                    stack.push(val);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x6d => { // OP_2DROP
                                if stack.len() >= 2 {
                                    stack.pop();
                                    stack.pop();
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x6e => { // OP_2DUP
                                if stack.len() >= 2 {
                                    let top1 = stack.items[stack.len() - 1].clone();
                                    let top2 = stack.items[stack.len() - 2].clone();
                                    stack.push(top2);
                                    stack.push(top1);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x6f => { // OP_3DUP
                                if stack.len() >= 3 {
                                    let len = stack.len();
                                    let val3 = stack.items[len - 3].clone();
                                    let val2 = stack.items[len - 2].clone();
                                    let val1 = stack.items[len - 1].clone();
                                    stack.push(val3);
                                    stack.push(val2);
                                    stack.push(val1);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x70 => { // OP_2OVER
                                if stack.len() >= 4 {
                                    let len = stack.len();
                                    let val4 = stack.items[len - 4].clone();
                                    let val3 = stack.items[len - 3].clone();
                                    stack.push(val4);
                                    stack.push(val3);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x71 => { // OP_2ROT
                                if stack.len() >= 6 {
                                    let len = stack.len();
                                    let mut items = stack.items.split_off(len - 6);
                                    let pair = items.drain(0..2).collect::<Vec<_>>();
                                    stack.items.extend(items);
                                    stack.items.extend(pair);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x72 => { // OP_2SWAP
                                if stack.len() >= 4 {
                                    let len = stack.len();
                                    stack.items.swap(len - 4, len - 2);
                                    stack.items.swap(len - 3, len - 1);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x73 => { // OP_IFDUP
                                if let Some(top) = stack.peek().cloned() {
                                    if is_true(&top) {
                                        stack.push(top);
                                    }
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x74 => { // OP_DEPTH
                                stack.push(script_number::encode(stack.len() as i64));
                            }
                            0x75 => { // OP_DROP
                                if stack.pop().is_none() {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x76 => { // OP_DUP
                                if let Some(top) = stack.peek().cloned() {
                                    stack.push(top);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x77 => { // OP_NIP
                                if stack.len() >= 2 {
                                    let len = stack.len();
                                    stack.items.remove(len - 2);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x78 => { // OP_OVER
                                if stack.len() >= 2 {
                                    let val = stack.items[stack.len() - 2].clone();
                                    stack.push(val);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x79 => { // OP_PICK
                                if let Some(n_bytes) = stack.pop() {
                                    let n = script_number::decode(&n_bytes) as usize;
                                    if stack.len() > n {
                                        let val = stack.items[stack.len() - 1 - n].clone();
                                        stack.push(val);
                                    } else {
                                        error = Some(DebugError::StackEmpty);
                                    }
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x7a => { // OP_ROLL
                                if let Some(n_bytes) = stack.pop() {
                                    let n = script_number::decode(&n_bytes) as usize;
                                    if stack.len() > n {
                                        let len = stack.len();
                                        let val = stack.items.remove(len - 1 - n);
                                        stack.push(val);
                                    } else {
                                        error = Some(DebugError::StackEmpty);
                                    }
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x7b => { // OP_ROT
                                if stack.len() >= 3 {
                                    let len = stack.len();
                                    let top = stack.items.remove(len - 3);
                                    stack.push(top);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x7c => { // OP_SWAP
                                if stack.len() >= 2 {
                                    let len = stack.len();
                                    stack.items.swap(len - 1, len - 2);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x7d => { // OP_TUCK
                                if stack.len() >= 2 {
                                    let len = stack.len();
                                    let top = stack.items[len - 1].clone();
                                    stack.items.insert(len - 2, top);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x82 => { // OP_SIZE
                                if let Some(top) = stack.peek() {
                                    stack.push(script_number::encode(top.len() as i64));
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x87 | 0x88 => { // OP_EQUAL, OP_EQUALVERIFY
                                if stack.len() >= 2 {
                                    let top1 = stack.pop().unwrap();
                                    let top2 = stack.pop().unwrap();
                                    let eq = top1 == top2;
                                    if op_byte == 0x87 {
                                        stack.push(vec![if eq { 1 } else { 0 }]);
                                    } else if !eq {
                                        error = Some(DebugError::VerifyFailed);
                                    }
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x9f..=0xa4 => { // OP_LESSTHAN to OP_MAX
                                if stack.len() >= 2 {
                                    let val2_bytes = stack.pop().unwrap();
                                    let val1_bytes = stack.pop().unwrap();
                                    let val2 = script_number::decode(&val2_bytes);
                                    let val1 = script_number::decode(&val1_bytes);
                                    match op_byte {
                                        0x9f => stack.push(vec![if val1 < val2 { 1 } else { 0 }]),
                                        0xa0 => stack.push(vec![if val1 > val2 { 1 } else { 0 }]),
                                        0xa1 => stack.push(vec![if val1 <= val2 { 1 } else { 0 }]),
                                        0xa2 => stack.push(vec![if val1 >= val2 { 1 } else { 0 }]),
                                        0xa3 => stack.push(script_number::encode(val1.min(val2))),
                                        0xa4 => stack.push(script_number::encode(val1.max(val2))),
                                        _ => unreachable!(),
                                    }
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0xa5 => { // OP_WITHIN
                                if stack.len() >= 3 {
                                    let max_bytes = stack.pop().unwrap();
                                    let min_bytes = stack.pop().unwrap();
                                    let x_bytes = stack.pop().unwrap();
                                    let max = script_number::decode(&max_bytes);
                                    let min = script_number::decode(&min_bytes);
                                    let x = script_number::decode(&x_bytes);
                                    let inside = x >= min && x < max;
                                    stack.push(vec![if inside { 1 } else { 0 }]);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0xa6 => { // OP_SHA256
                                if let Some(val) = stack.pop() {
                                    stack.push(sha256(&val));
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0xa7 => { // OP_SHA1
                                if let Some(val) = stack.pop() {
                                    stack.push(sha1(&val));
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0xa8 => { // OP_RIPEMD160
                                if let Some(val) = stack.pop() {
                                    stack.push(ripemd160(&val));
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0xa9 => { // OP_HASH160
                                if let Some(val) = stack.pop() {
                                    stack.push(hash160(&val));
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0xaa => { // OP_HASH256
                                if let Some(val) = stack.pop() {
                                    stack.push(hash256(&val));
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0xac | 0xad => { // OP_CHECKSIG, OP_CHECKSIGVERIFY
                                if stack.len() >= 2 {
                                    let pk = stack.pop().unwrap();
                                    let sig = stack.pop().unwrap();
                                    let verified = try_verify_sig(
                                        &sig,
                                        &pk,
                                        raw_tx_hex,
                                        input_index,
                                        &current_script_hex,
                                        prevout_value,
                                        prevouts.as_deref(),
                                        taproot_leaf_hash,
                                        script_pubkey_hex,
                                    );
                                    let ok = verified.unwrap_or(true);
                                    if op_byte == 0xac {
                                        stack.push(vec![if ok { 1 } else { 0 }]);
                                        if verified.is_none() {
                                            error = Some(DebugError::ChecksigSkipped);
                                        }
                                    } else {
                                        if !ok {
                                            error = Some(DebugError::VerifyFailed);
                                        } else if verified.is_none() {
                                            error = Some(DebugError::ChecksigSkipped);
                                        }
                                    }
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0xae | 0xaf => { // OP_CHECKMULTISIG, OP_CHECKMULTISIGVERIFY
                                if let Some(n_bytes) = stack.pop() {
                                    let n = script_number::decode(&n_bytes) as usize;
                                    if stack.len() >= n + 1 {
                                        let mut pks = Vec::new();
                                        for _ in 0..n {
                                            pks.push(stack.pop().unwrap());
                                        }
                                        if let Some(m_bytes) = stack.pop() {
                                            let m = script_number::decode(&m_bytes) as usize;
                                            if stack.len() >= m + 1 {
                                                for _ in 0..m {
                                                    stack.pop();
                                                }
                                                stack.pop(); // Pop dummy
                                                if op_byte == 0xae {
                                                    stack.push(vec![1]);
                                                }
                                            } else {
                                                error = Some(DebugError::StackEmpty);
                                            }
                                        } else {
                                            error = Some(DebugError::StackEmpty);
                                        }
                                    } else {
                                        error = Some(DebugError::StackEmpty);
                                    }
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x93 | 0x94 => { // OP_ADD, OP_SUB
                                if stack.len() >= 2 {
                                    let val2_bytes = stack.pop().unwrap();
                                    let val1_bytes = stack.pop().unwrap();
                                    let val2 = script_number::decode(&val2_bytes);
                                    let val1 = script_number::decode(&val1_bytes);
                                    let res = if op_byte == 0x93 { val1 + val2 } else { val1 - val2 };
                                    stack.push(script_number::encode(res));
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x8b => { // OP_1ADD
                                if let Some(val_bytes) = stack.pop() {
                                    let val = script_number::decode(&val_bytes);
                                    stack.push(script_number::encode(val + 1));
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x8c => { // OP_1SUB
                                if let Some(val_bytes) = stack.pop() {
                                    let val = script_number::decode(&val_bytes);
                                    stack.push(script_number::encode(val - 1));
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x8f => { // OP_NEGATE
                                if let Some(val_bytes) = stack.pop() {
                                    let val = script_number::decode(&val_bytes);
                                    stack.push(script_number::encode(-val));
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x90 => { // OP_ABS
                                if let Some(val_bytes) = stack.pop() {
                                    let val = script_number::decode(&val_bytes);
                                    stack.push(script_number::encode(val.abs()));
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x91 => { // OP_NOT
                                if let Some(val_bytes) = stack.pop() {
                                    let val = is_true(&val_bytes);
                                    stack.push(vec![if val { 0 } else { 1 }]);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x92 => { // OP_0NOTEQUAL
                                if let Some(val_bytes) = stack.pop() {
                                    let val = is_true(&val_bytes);
                                    stack.push(vec![if val { 1 } else { 0 }]);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x9c | 0x9d => { // OP_NUMEQUAL, OP_NUMEQUALVERIFY
                                if stack.len() >= 2 {
                                    let val2_bytes = stack.pop().unwrap();
                                    let val1_bytes = stack.pop().unwrap();
                                    let eq = script_number::decode(&val1_bytes) == script_number::decode(&val2_bytes);
                                    if op_byte == 0x9c {
                                        stack.push(vec![if eq { 1 } else { 0 }]);
                                    } else if !eq {
                                        error = Some(DebugError::VerifyFailed);
                                    }
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x9e => { // OP_NUMNOTEQUAL
                                if stack.len() >= 2 {
                                    let val2_bytes = stack.pop().unwrap();
                                    let val1_bytes = stack.pop().unwrap();
                                    let eq = script_number::decode(&val1_bytes) != script_number::decode(&val2_bytes);
                                    stack.push(vec![if eq { 1 } else { 0 }]);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x9a => { // OP_BOOLAND
                                if stack.len() >= 2 {
                                    let val2 = is_true(&stack.pop().unwrap());
                                    let val1 = is_true(&stack.pop().unwrap());
                                    stack.push(vec![if val1 && val2 { 1 } else { 0 }]);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x9b => { // OP_BOOLOR
                                if stack.len() >= 2 {
                                    let val2 = is_true(&stack.pop().unwrap());
                                    let val1 = is_true(&stack.pop().unwrap());
                                    stack.push(vec![if val1 || val2 { 1 } else { 0 }]);
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x69 => { // OP_VERIFY
                                if let Some(val_bytes) = stack.pop() {
                                    if !is_true(&val_bytes) {
                                        error = Some(DebugError::VerifyFailed);
                                    }
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            0x6a => { // OP_RETURN
                                error = Some(DebugError::VerifyFailed);
                            }
                            0xab => {} // OP_CODESEPARATOR
                            0xb1 | 0xb2 => { // OP_CHECKLOCKTIMEVERIFY, OP_CHECKSEQUENCEVERIFY
                                if let Some(top) = stack.peek() {
                                    op_data = Some(format!("(value: {})", script_number::decode(top)));
                                } else {
                                    error = Some(DebugError::StackEmpty);
                                }
                            }
                            _ => {}
                        }
                    }
                }
                (op_name, op_hex, op_data)
            }
            OwnedInstruction::PushBytes(bytes) => {
                let op_name = format!("PUSHDATA_{}", bytes.len());
                let op_hex = hex::encode(&bytes);
                let p_data = hex::encode(&bytes);

                if execution_enabled {
                    stack.push(bytes.clone());
                }
                (op_name, op_hex, Some(p_data))
            }
        };

        let (stack_before, stack_after) = diff_stacks(&stack_before_raw, &stack.items);

        if error.is_none() && (stack.len() + alt_stack.len()) > 1000 {
            error = Some(DebugError::StackSizeExceeded);
        }

        steps.push(DebugStep {
            step_index: steps.len(),
            opcode: opcode_name,
            opcode_hex,
            data: pushed_data,
            stack_before,
            stack_after,
            error: error.clone(),
        });

        if error.is_some() && error != Some(DebugError::ChecksigSkipped) {
            break;
        }

        if pc == sig_instructions_len && is_p2sh {
            p2sh_redeem_script_bytes = stack.peek().cloned();
        }

        if pc == instructions.len() && is_p2sh && !p2sh_executed {
            p2sh_executed = true;
            if let Some(eq_result) = stack.pop() {
                if is_true(&eq_result) {
                    if let Some(redeem_script_bytes) = p2sh_redeem_script_bytes.clone() {
                        let redeem_script = Script::from_bytes(&redeem_script_bytes).to_owned();
                        if redeem_script.is_p2wpkh() {
                            stack.items.clear();
                            if witness_hex.len() >= 2 {
                                let sig_hex = &witness_hex[0];
                                let pubkey_hex = &witness_hex[1];
                                for item in &[sig_hex, pubkey_hex] {
                                    if let Ok(b) = hex::decode(item) {
                                        let before = stack.items.clone();
                                        stack.push(b.clone());
                                        let (s_before, s_after) = diff_stacks(&before, &stack.items);
                                        steps.push(DebugStep {
                                            step_index: steps.len(),
                                            opcode: "WITNESS_PUSH".to_string(),
                                            opcode_hex: String::new(),
                                            data: Some((*item).clone()),
                                            stack_before: s_before,
                                            stack_after: s_after,
                                            error: None,
                                        });
                                    }
                                }
                            }
                            let keyhash = &redeem_script_bytes[2..22];
                            let keyhash_pb = <&bitcoin::script::PushBytes>::try_from(keyhash).unwrap();
                            let virtual_script = bitcoin::blockdata::script::Builder::new()
                                .push_opcode(bitcoin::opcodes::all::OP_DUP)
                                .push_opcode(bitcoin::opcodes::all::OP_HASH160)
                                .push_slice(keyhash_pb)
                                .push_opcode(bitcoin::opcodes::all::OP_EQUALVERIFY)
                                .push_opcode(bitcoin::opcodes::all::OP_CHECKSIG)
                                .into_script();
                            script_lifetimes.push(virtual_script);
                            current_script_hex = hex::encode(script_lifetimes.last().unwrap().as_bytes());
                            let redeem_ins = script_lifetimes.last().unwrap().instructions()
                                .collect::<Result<Vec<_>, _>>()
                                .unwrap_or_default()
                                .into_iter()
                                .map(OwnedInstruction::from);
                            steps.push(DebugStep {
                                step_index: steps.len(),
                                opcode: "P2SH_NESTED_P2WPKH_EXECUTION".to_string(),
                                opcode_hex: String::new(),
                                data: Some(hex::encode(&redeem_script_bytes)),
                                stack_before: diff_stacks(&stack.items, &stack.items).0,
                                stack_after: diff_stacks(&stack.items, &stack.items).1,
                                error: None,
                            });
                            instructions.extend(redeem_ins);
                        } else if redeem_script.is_p2wsh() {
                            stack.items.clear();
                            let mut witness_items = witness_hex.to_vec();
                            let witness_script_hex = witness_items.pop().unwrap_or_default();
                            for item in witness_items {
                                if let Ok(b) = hex::decode(&item) {
                                    let before = stack.items.clone();
                                    stack.push(b);
                                    let (s_before, s_after) = diff_stacks(&before, &stack.items);
                                    steps.push(DebugStep {
                                        step_index: steps.len(),
                                        opcode: "WITNESS_PUSH".to_string(),
                                        opcode_hex: String::new(),
                                        data: Some(item),
                                        stack_before: s_before,
                                        stack_after: s_after,
                                        error: None,
                                    });
                                }
                            }
                            let witness_script_bytes = hex::decode(&witness_script_hex).unwrap_or_default();
                            let w_script = Script::from_bytes(&witness_script_bytes).to_owned();
                            script_lifetimes.push(w_script);
                            current_script_hex = witness_script_hex;
                            let redeem_ins = script_lifetimes.last().unwrap().instructions()
                                .collect::<Result<Vec<_>, _>>()
                                .unwrap_or_default()
                                .into_iter()
                                .map(OwnedInstruction::from);
                            steps.push(DebugStep {
                                step_index: steps.len(),
                                opcode: "P2SH_NESTED_P2WSH_EXECUTION".to_string(),
                                opcode_hex: String::new(),
                                data: Some(hex::encode(&redeem_script_bytes)),
                                stack_before: diff_stacks(&stack.items, &stack.items).0,
                                stack_after: diff_stacks(&stack.items, &stack.items).1,
                                error: None,
                            });
                            instructions.extend(redeem_ins);
                        } else {
                            script_lifetimes.push(redeem_script);
                            current_script_hex = hex::encode(&redeem_script_bytes);
                            let redeem_ins = script_lifetimes.last().unwrap().instructions()
                                .collect::<Result<Vec<_>, _>>()
                                .unwrap_or_default()
                                .into_iter()
                                .map(OwnedInstruction::from);
                            steps.push(DebugStep {
                                step_index: steps.len(),
                                opcode: "P2SH_REDEEM_SCRIPT_EXECUTION".to_string(),
                                opcode_hex: String::new(),
                                data: Some(hex::encode(&redeem_script_bytes)),
                                stack_before: diff_stacks(&stack.items, &stack.items).0,
                                stack_after: diff_stacks(&stack.items, &stack.items).1,
                                error: None,
                            });
                            instructions.extend(redeem_ins);
                        }
                    } else {
                        error = Some(DebugError::StackEmpty);
                    }
                } else {
                    error = Some(DebugError::VerifyFailed);
                }
            } else {
                error = Some(DebugError::StackEmpty);
            }

            if error.is_some() {
                steps.push(DebugStep {
                    step_index: steps.len(),
                    opcode: "P2SH_REDEEM_SCRIPT_EXECUTION_FAILED".to_string(),
                    opcode_hex: String::new(),
                    data: None,
                    stack_before: diff_stacks(&stack.items, &stack.items).0,
                    stack_after: diff_stacks(&stack.items, &stack.items).1,
                    error: error.clone(),
                });
                break;
            }
        }
    }

    if is_taproot_keypath {
        let stack_before_raw = stack.items.clone();
        let mut step_err = None;
        let pk_bytes = &pubkey_bytes[2..34];
        if let Some(sig_bytes) = stack.peek().cloned() {
            let verified = try_verify_sig(
                &sig_bytes,
                pk_bytes,
                raw_tx_hex,
                input_index,
                &current_script_hex,
                prevout_value,
                prevouts.as_deref(),
                None,
                script_pubkey_hex,
            );
            let ok = verified.unwrap_or(true);
            stack.pop();
            stack.push(vec![if ok { 1 } else { 0 }]);
            if !ok {
                step_err = Some(DebugError::VerifyFailed);
            } else if verified.is_none() {
                step_err = Some(DebugError::ChecksigSkipped);
            }
        } else {
            step_err = Some(DebugError::StackEmpty);
        }
        let (s_before, s_after) = diff_stacks(&stack_before_raw, &stack.items);
        steps.push(DebugStep {
            step_index: steps.len(),
            opcode: "TAPROOT_KEY_PATH_VALIDATION".to_string(),
            opcode_hex: String::new(),
            data: None,
            stack_before: s_before,
            stack_after: s_after,
            error: step_err,
        });
    }

    Ok(steps)
}

fn is_true(bytes: &[u8]) -> bool {
    for &b in bytes {
        if b != 0 {
            if bytes.len() == 1 && b == 0x80 {
                return false;
            }
            return true;
        }
    }
    false
}

fn diff_stacks(before: &[Vec<u8>], after: &[Vec<u8>]) -> (Vec<String>, Vec<String>) {
    let before_hex = before.iter().map(|b| hex::encode(b)).collect();
    let after_hex = after.iter().map(|b| hex::encode(b)).collect();
    (before_hex, after_hex)
}
