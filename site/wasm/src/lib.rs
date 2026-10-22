//! The Rust tour from `demos/tour/rust`, unchanged, compiled to wasm for the
//! site. Its `println!` goes to `print`, which the page provides.

#[link(wasm_import_module = "env")]
extern "C" {
    fn print(text: *const u8, len: usize);
}

fn emit(text: &str) {
    // SAFETY: the page only reads `len` bytes from `text`, during the call.
    unsafe { print(text.as_ptr(), text.len()) }
}

// Shadows std's `println!` for the included tour.
macro_rules! println {
    () => {
        emit("\n")
    };
    ($($arg:tt)*) => {
        emit(&format!("{}\n", format_args!($($arg)*)))
    };
}

include!(concat!(env!("OUT_DIR"), "/tour.rs"));

/// Runs the tour, returning 0 on success.
#[no_mangle]
pub extern "C" fn run() -> i32 {
    match main() {
        Ok(()) => 0,
        Err(_) => 1,
    }
}
