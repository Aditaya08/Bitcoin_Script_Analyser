pub mod input;
pub mod script;
pub mod witness;

pub use input::{classify_input, classify_input_script};
pub use script::classify_script;
pub use witness::{classify_witness, classify_witness_item, parse_witness_item};
