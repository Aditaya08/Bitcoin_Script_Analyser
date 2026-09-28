use bitcoin::script::{Instruction, Script};
use crate::types::{OpReturnProtocol, ScriptType};

pub fn classify_script(script: &Script) -> ScriptType {
    if script.is_p2pkh() {
        ScriptType::P2PKH
    } else if script.is_p2sh() {
        ScriptType::P2SH
    } else if script.is_p2wpkh() {
        ScriptType::P2WPKH
    } else if script.is_p2wsh() {
        ScriptType::P2WSH
    } else if script.is_p2tr() {
        ScriptType::P2TR
    } else if is_p2pk(script) {
        ScriptType::P2PK
    } else if let Some((m, n)) = classify_multisig(script) {
        ScriptType::P2MS { m, n }
    } else if let Some(op_return) = classify_op_return(script) {
        op_return
    } else {
        ScriptType::NonStandard
    }
}

fn is_p2pk(script: &Script) -> bool {
    if let Ok(instructions) = script.instructions().collect::<Result<Vec<_>, _>>() {
        if instructions.len() == 2 {
            if let (Instruction::PushBytes(bytes), Instruction::Op(op)) = (&instructions[0], &instructions[1]) {
                if (bytes.len() == 33 || bytes.len() == 65) && op.to_u8() == 172 { // OP_CHECKSIG is 172
                    return true;
                }
            }
        }
    }
    false
}

fn classify_multisig(script: &Script) -> Option<(u8, u8)> {
    let instructions = script.instructions().collect::<Result<Vec<_>, _>>().ok()?;
    if instructions.len() < 4 {
        return None;
    }
    let first = instructions.first()?;
    let last = instructions.last()?;
    let penultimate = instructions.get(instructions.len() - 2)?;

    if let Instruction::Op(op) = last {
        if op.to_u8() != 174 { // OP_CHECKMULTISIG is 174
            return None;
        }
    } else {
        return None;
    }

    let m = get_small_integer(first)?;
    let n = get_small_integer(penultimate)?;
    if m == 0 || n == 0 || m > n {
        return None;
    }

    let pubkeys = &instructions[1..instructions.len() - 2];
    if pubkeys.len() != n as usize {
        return None;
    }

    for pk in pubkeys {
        match pk {
            Instruction::PushBytes(bytes) => {
                if bytes.len() != 33 && bytes.len() != 65 {
                    return None;
                }
            }
            _ => return None,
        }
    }

    Some((m, n))
}

fn get_small_integer(ins: &Instruction) -> Option<u8> {
    match ins {
        Instruction::Op(op) => {
            let val = op.to_u8();
            if val == 0 { // OP_0
                Some(0)
            } else if val >= 81 && val <= 96 { // OP_1 (81) to OP_16 (96)
                Some(val - 81 + 1)
            } else {
                None
            }
        }
        _ => None,
    }
}

fn classify_op_return(script: &Script) -> Option<ScriptType> {
    let bytes = script.as_bytes();
    if bytes.first() != Some(&0x6a) {
        return None;
    }

    let instructions = script.instructions().collect::<Result<Vec<_>, _>>().ok()?;
    let mut protocol = None;

    if instructions.len() > 1 {
        if let Some(Instruction::Op(op)) = instructions.get(1) {
            if op.to_u8() == 93 { // OP_13 is 93
                protocol = Some(OpReturnProtocol::Ordinals);
            }
        }
    }

    let mut pushed_data = Vec::new();
    for ins in instructions.iter().skip(1) {
        if let Instruction::PushBytes(pb) = ins {
            pushed_data = pb.as_bytes().to_vec();
            break;
        }
    }

    if hex::encode(&pushed_data).starts_with("6f6d6e69") {
        protocol = Some(OpReturnProtocol::OmniLayer);
    }

    Some(ScriptType::OpReturn {
        data: pushed_data,
        protocol,
    })
}
