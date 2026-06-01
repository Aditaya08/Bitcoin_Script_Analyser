pub fn is_valid_txid(txid: &str) -> bool {
    txid.len() == 64 && txid.chars().all(|c| c.is_ascii_hexdigit())
}

pub fn is_valid_hex(hex: &str) -> bool {
    hex.len() % 2 == 0 && hex.chars().all(|c| c.is_ascii_hexdigit())
}
