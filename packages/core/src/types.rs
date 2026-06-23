use serde::{Deserialize, Deserializer, Serialize, Serializer};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScriptType {
    P2PK,
    P2PKH,
    P2SH,
    P2WPKH,
    P2WSH,
    P2TR,
    P2MS { m: u8, n: u8 },
    OpReturn { data: Vec<u8>, protocol: Option<OpReturnProtocol> },
    NonStandard,
}

impl Serialize for ScriptType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let s = match self {
            ScriptType::P2PK => "P2PK",
            ScriptType::P2PKH => "P2PKH",
            ScriptType::P2SH => "P2SH",
            ScriptType::P2WPKH => "P2WPKH",
            ScriptType::P2WSH => "P2WSH",
            ScriptType::P2TR => "P2TR",
            ScriptType::P2MS { .. } => "P2MS",
            ScriptType::OpReturn { .. } => "OP_RETURN",
            ScriptType::NonStandard => "NONSTANDARD",
        };
        serializer.serialize_str(s)
    }
}

impl<'de> Deserialize<'de> for ScriptType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        match s.as_str() {
            "P2PK" => Ok(ScriptType::P2PK),
            "P2PKH" => Ok(ScriptType::P2PKH),
            "P2SH" => Ok(ScriptType::P2SH),
            "P2WPKH" => Ok(ScriptType::P2WPKH),
            "P2WSH" => Ok(ScriptType::P2WSH),
            "P2TR" => Ok(ScriptType::P2TR),
            "P2MS" => Ok(ScriptType::P2MS { m: 0, n: 0 }),
            "OP_RETURN" => Ok(ScriptType::OpReturn { data: vec![], protocol: None }),
            _ => Ok(ScriptType::NonStandard),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum OpReturnProtocol {
    #[serde(rename = "OMNI")]
    OmniLayer,
    #[serde(rename = "ORDINALS_RUNES")]
    Ordinals,
    #[serde(rename = "RUNES")] // custom or standard
    Runes,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum WitnessType {
    #[serde(rename = "P2WPKH")]
    P2WPKH,
    #[serde(rename = "P2WSH")]
    P2WSH,
    #[serde(rename = "P2TR_KEY_PATH")]
    P2TRKeyPath,
    #[serde(rename = "P2TR_SCRIPT_PATH")]
    P2TRScriptPath,
    #[serde(rename = "UNKNOWN")]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum WitnessItemType {
    DerSignature,
    SchnorrSignature { spend_type: TaprootSpendType },
    CompressedPubkey,
    UncompressedPubkey,
    ControlBlock,
    Tapscript,
    Annex,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TaprootSpendType {
    #[serde(rename = "KEY_PATH")]
    KeyPath,
    #[serde(rename = "SCRIPT_PATH")]
    ScriptPath,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TxAnalysis {
    pub txid: String,
    pub version: i32,
    pub locktime: u32,
    pub size: usize,
    pub vsize: usize,
    pub weight: usize,
    pub fee: u64,
    pub feerate: f64,
    pub inputs: Vec<InputAnalysis>,
    pub outputs: Vec<OutputAnalysis>,
    pub raw_tx_hex: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputAnalysis {
    pub index: u32,
    pub prevout: String, // "txid:vout"
    pub sequence: u32,
    pub script_sig_hex: String,
    pub script_sig_asm: String,
    pub witness: Vec<String>, // each item as hex
    pub script_type: ScriptType,
    pub witness_type: Option<WitnessType>,
    pub witness_items: Vec<WitnessItemAnalysis>,
    pub taproot_detail: Option<TaprootDetail>,
    pub prevout_script_pub_key_hex: Option<String>,
    pub prevout_script_pub_key_asm: Option<String>,
    pub prevout_value_sats: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputAnalysis {
    pub index: u32,
    pub values_sats: u64,
    pub value_btc: String,
    pub script_pubkey_hex: String,
    pub script_pubkey_asm: String,
    pub script_type: ScriptType,
    pub address: Option<String>,
    pub op_return_decoded: Option<String>,
    pub op_return_protocol: Option<OpReturnProtocol>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WitnessItemAnalysis {
    pub index: usize,
    pub hex: String,
    pub bytes: usize,
    pub item_type: WitnessItemType,
    pub parsed: WitnessItemParsed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum WitnessItemParsed {
    DerSig { r: String, s: String, sighash: u8, low_s: bool },
    SchnorrSig { r: String, s: String, sighash_flag: Option<u8> },
    Pubkey { prefix: u8, x_coord: String, compressed: bool },
    ControlBlock { leaf_version: u8, parity: u8, internal_key: String, merkle_depth: usize },
    Tapscript { asm: String, script_type: ScriptType },
    Raw { hex: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaprootDetail {
    pub spend_type: TaprootSpendType,
    pub schnorr_sig: Option<String>,
    pub internal_key: Option<String>,
    pub control_block: Option<String>,
    pub control_block_depth: Option<usize>,
    pub leaf_script_hex: Option<String>,
    pub leaf_script_asm: Option<String>,
    pub leaf_script_type: Option<ScriptType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugStep {
    pub step_index: usize,
    pub opcode: String,
    pub opcode_hex: String,
    pub data: Option<String>,
    pub stack_before: Vec<String>,
    pub stack_after: Vec<String>,
    pub error: Option<DebugError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StackItem {
    pub hex: String,
    pub bytes: usize,
    pub item_type: StackItemType,
    pub is_new: bool,
    pub is_consumed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StackItemType {
    Sig,
    Pubkey,
    Hash160,
    Bool,
    Int,
    Data,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DebugError {
    #[serde(rename = "STACK_EMPTY")]
    StackEmpty,
    #[serde(rename = "VERIFY_FAILED")]
    VerifyFailed,
    #[serde(rename = "CHECKSIG_SKIPPED")]
    ChecksigSkipped,
    #[serde(rename = "STACK_SIZE_EXCEEDED")]
    StackSizeExceeded,
    #[serde(rename = "OP_COUNT_EXCEEDED")]
    OpCountExceeded,
}
