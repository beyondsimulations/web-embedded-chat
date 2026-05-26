use argon2::{
    Argon2,
    PasswordHasher,
    password_hash::{SaltString, rand_core::OsRng},
};

fn main() {
    let password = std::env::args().nth(1).unwrap_or_else(|| {
        eprintln!("Usage: hash_password <password>");
        eprintln!("  Generates an argon2id hash for use as DASHBOARD_PASSWORD_HASH");
        std::process::exit(1);
    });

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .expect("Failed to hash password");

    println!("{}", hash);
}
