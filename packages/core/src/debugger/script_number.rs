pub fn decode(bytes: &[u8]) -> i64 {
    if bytes.is_empty() {
        return 0;
    }
    if bytes.len() > 8 {
        let truncated = &bytes[0..8];
        return decode(truncated);
    }
    let mut result: i64 = 0;
    for (i, &b) in bytes.iter().enumerate() {
        result |= (b as i64) << (8 * i);
    }
    let last = bytes[bytes.len() - 1];
    if (last & 0x80) != 0 {
        let bit_len = 8 * bytes.len();
        let mask = if bit_len >= 64 {
            i64::MAX
        } else {
            (1i64 << (bit_len - 1)) - 1
        };
        result = -(result & mask);
    }
    result
}

pub fn encode(value: i64) -> Vec<u8> {
    if value == 0 {
        return Vec::new();
    }
    let mut bytes = Vec::new();
    let mut abs_value = value.abs();
    let negative = value < 0;
    while abs_value > 0 {
        bytes.push((abs_value & 0xff) as u8);
        abs_value >>= 8;
    }
    if let Some(last) = bytes.last_mut() {
        if (*last & 0x80) != 0 {
            bytes.push(if negative { 0x80 } else { 0 });
        } else if negative {
            *last |= 0x80;
        }
    }
    bytes
}
