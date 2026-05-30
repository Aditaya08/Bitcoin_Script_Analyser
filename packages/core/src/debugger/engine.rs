use bitcoin::script::{Instruction, Script};
use crate::types::{DebugError, DebugStep};
use crate::debugger::stack::Stack;
use crate::debugger::script_number;
use crate::debugger::crypto::verify_signature;
use crate::utils::crypto::{sha256, hash256, ripemd160, hash160};

pub fn debug_script(
    script_sig_hex: &str,
    script_pubkey_hex: &str,
    witness_hex: &[String],
) -> Result<Vec<DebugStep>, hex::FromHexError> {
    let mut steps = Vec::new();
    let mut stack = Stack::new();

    for wit_hex in witness_hex {
        if let Ok(wit_bytes) = hex::decode(wit_hex) {
            let stack_before_raw = stack.items.clone();
            stack.push(wit_bytes);
            let (stack_before, stack_after) = diff_stacks(&stack_before_raw, &stack.items);
            steps.push(DebugStep {
                step_index: steps.len(),
                opcode: "WITNESS_PUSH".to_string(),
                opcode_hex: String::new(),
                data: Some(wit_hex.clone()),
                stack_before,
                stack_after,
                error: None,
            });
        }
    }

    let mut if_stack: Vec<bool> = Vec::new();
    let mut instructions = Vec::new();

    let sig_bytes = if !script_sig_hex.is_empty() {
        hex::decode(script_sig_hex)?
    } else {
        Vec::new()
    };
    
    let pubkey_bytes = if !script_pubkey_hex.is_empty() {
        hex::decode(script_pubkey_hex)?
    } else {
        Vec::new()
    };

    if !sig_bytes.is_empty() {
        let sig_script = Script::from_bytes(&sig_bytes);
        if let Ok(ins) = sig_script.instructions().collect::<Result<Vec<_>, _>>() {
            instructions.extend(ins);
        }
    }

    if !pubkey_bytes.is_empty() {
        let pubkey_script = Script::from_bytes(&pubkey_bytes);
        if let Ok(ins) = pubkey_script.instructions().collect::<Result<Vec<_>, _>>() {
            instructions.extend(ins);
        }
    }

    for instruction in instructions.into_iter() {
        let execution_enabled = if_stack.iter().all(|&x| x);
        let stack_before_raw = stack.items.clone();

        let mut error = None;

        let (opcode_name, opcode_hex, pushed_data) = match instruction {
            Instruction::Op(op) => {
                let op_byte = op.to_u8();
                let op_name = op.to_string();
                let op_hex = hex::encode(&[op_byte]);

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

                        0x76 => { // OP_DUP
                            if let Some(top) = stack.peek().cloned() {
                                stack.push(top);
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
                        0x75 => { // OP_DROP
                            if stack.pop().is_none() {
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
                        0x7c => { // OP_SWAP
                            if stack.len() >= 2 {
                                let len = stack.len();
                                stack.items.swap(len - 1, len - 2);
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
                        0x79 => { // OP_OVER
                            if stack.len() >= 2 {
                                let val = stack.items[stack.len() - 2].clone();
                                stack.push(val);
                            } else {
                                error = Some(DebugError::StackEmpty);
                            }
                        }
                        0x7a => { // OP_PICK
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
                        0x7b => { // OP_ROLL
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
                        0x7d => { // OP_ROT
                            if stack.len() >= 3 {
                                let len = stack.len();
                                let top = stack.items.remove(len - 3);
                                stack.push(top);
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
                        0xa6 => { // OP_SHA256
                            if let Some(val) = stack.pop() {
                                stack.push(sha256(&val));
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
                        0xac | 0xad => { // OP_CHECKSIG, OP_CHECKSIGVERIFY
                            if stack.len() >= 2 {
                                let pk = stack.pop().unwrap();
                                let sig = stack.pop().unwrap();
                                let ok = verify_signature(&sig, &pk, &[0u8; 32]);
                                if op_byte == 0xac {
                                    stack.push(vec![if ok { 1 } else { 0 }]);
                                } else if !ok {
                                    error = Some(DebugError::VerifyFailed);
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
                        _ => {}
                    }
                }
                (op_name, op_hex, None)
            }
            Instruction::PushBytes(bytes) => {
                let op_name = format!("PUSHDATA_{}", bytes.len());
                let op_hex = hex::encode(bytes.as_bytes());
                let p_data = hex::encode(bytes.as_bytes());

                if execution_enabled {
                    stack.push(bytes.as_bytes().to_vec());
                }
                (op_name, op_hex, Some(p_data))
            }
        };

        let (stack_before, stack_after) = diff_stacks(&stack_before_raw, &stack.items);

        steps.push(DebugStep {
            step_index: steps.len(),
            opcode: opcode_name,
            opcode_hex,
            data: pushed_data,
            stack_before,
            stack_after,
            error: error.clone(),
        });

        if error.is_some() {
            break;
        }
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
