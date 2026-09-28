use crate::types::{StackItem, StackItemType};

#[derive(Debug, Clone)]
pub struct Stack {
    pub items: Vec<Vec<u8>>,
}

impl Stack {
    pub fn new() -> Self {
        Stack { items: Vec::new() }
    }

    pub fn push(&mut self, item: Vec<u8>) {
        self.items.push(item);
    }

    pub fn pop(&mut self) -> Option<Vec<u8>> {
        self.items.pop()
    }

    pub fn peek(&self) -> Option<&Vec<u8>> {
        self.items.last()
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }
}

pub fn to_stack_item(bytes: &[u8], is_new: bool, is_consumed: bool) -> StackItem {
    let item_type = infer_item_type(bytes);
    StackItem {
        hex: hex::encode(bytes),
        bytes: bytes.len(),
        item_type,
        is_new,
        is_consumed,
    }
}

pub fn infer_item_type(bytes: &[u8]) -> StackItemType {
    if bytes.is_empty() {
        return StackItemType::Bool;
    }
    if bytes.len() == 1 && (bytes[0] == 1 || bytes[0] == 0) {
        return StackItemType::Bool;
    }
    if bytes.len() == 33 || bytes.len() == 65 {
        if bytes[0] == 0x02 || bytes[0] == 0x03 || bytes[0] == 0x04 {
            return StackItemType::Pubkey;
        }
    }
    if bytes.len() == 32 {
        // x-only pubkey (taproot)
        return StackItemType::Pubkey;
    }
    if bytes.len() >= 71 && bytes.len() <= 73 && bytes[0] == 0x30 {
        return StackItemType::Sig;
    }
    if bytes.len() == 64 || bytes.len() == 65 {
        return StackItemType::Sig;
    }
    if bytes.len() == 20 {
        return StackItemType::Hash160;
    }
    if bytes.len() <= 4 {
        return StackItemType::Int;
    }
    StackItemType::Data
}
