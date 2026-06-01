use ripemd::Ripemd160;
use sha2::{Sha256, Digest};

pub fn sha256(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

pub fn hash256(data: &[u8]) -> Vec<u8> {
    sha256(&sha256(data))
}

pub fn ripemd160(data: &[u8]) -> Vec<u8> {
    let mut hasher = Ripemd160::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

pub fn hash160(data: &[u8]) -> Vec<u8> {
    ripemd160(&sha256(data))
}

pub fn is_pubkey(data: &[u8]) -> bool {
    data.len() == 33 || data.len() == 65
}

pub fn safe_utf8_decode(data: &[u8]) -> Option<String> {
    if data.is_empty() {
        return Some(String::new());
    }
    let s = std::str::from_utf8(data).ok()?;
    for c in s.chars() {
        let b = c as u32;
        if b == 0x09 || b == 0x0A || b == 0x0D || (b >= 0x20 && b <= 0x7E) {
            continue;
        } else {
            return None;
        }
    }
    Some(s.to_string())
}
