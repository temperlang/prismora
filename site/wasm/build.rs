//! Copies the Rust tour for `include!`, without its `//!` doc comment,
//! which can't appear partway into a module.

use std::{env, fs, path::Path};

fn main() {
    let tour = "../../demos/tour/rust/src/main.rs";
    println!("cargo::rerun-if-changed={tour}");
    let source = fs::read_to_string(tour).expect("the Rust tour");
    let body: String = source.lines().skip_while(|line| line.starts_with("//!")).map(|line| format!("{line}\n")).collect();
    fs::write(Path::new(&env::var("OUT_DIR").unwrap()).join("tour.rs"), body).unwrap();
}
