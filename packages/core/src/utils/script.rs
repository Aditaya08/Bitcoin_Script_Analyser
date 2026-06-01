use bitcoin::script::{Instruction, Script};

pub fn script_to_asm(script: &Script) -> String {
    let mut parts = Vec::new();
    for instruction in script.instructions() {
        match instruction {
            Ok(Instruction::Op(op)) => {
                parts.push(op.to_string());
            }
            Ok(Instruction::PushBytes(bytes)) => {
                parts.push(hex::encode(bytes.as_bytes()));
            }
            Err(_) => {
                // If it's invalid byte sequences, we can ignore or return empty
            }
        }
    }
    parts.join(" ")
}

pub fn truncate_hex(hex: &str, chars: usize) -> String {
    if hex.len() <= chars * 2 {
        hex.to_string()
    } else {
        format!("{}…{}", &hex[..chars], &hex[hex.len() - chars..])
    }
}

pub fn decompile(hex_str: &str) -> Result<Vec<(String, Option<Vec<u8>>)>, hex::FromHexError> {
    let bytes = hex::decode(hex_str)?;
    let script = Script::from_bytes(&bytes);
    let mut chunks = Vec::new();
    for instruction in script.instructions() {
        match instruction {
            Ok(Instruction::Op(op)) => {
                chunks.push((op.to_string(), None));
            }
            Ok(Instruction::PushBytes(bytes)) => {
                chunks.push((
                    format!("PUSHDATA_{}", bytes.len()),
                    Some(bytes.as_bytes().to_vec()),
                ));
            }
            Err(_) => {}
        }
    }
    Ok(chunks)
}
