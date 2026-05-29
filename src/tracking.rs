use sha2::{Digest, Sha256};
use std::net::IpAddr;

/// Hashes a client IP into a pseudonymous user ID, scoped to a semester salt.
///
/// Rotating the salt (e.g. between teaching semesters) produces a disjoint
/// ID space, so prior cohorts cannot be joined to the current one.
pub fn hash_user_id(ip: IpAddr, semester_salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(ip.to_string().as_bytes());
    hasher.update(b"|");
    hasher.update(semester_salt.as_bytes());
    format!("{:x}", hasher.finalize())
}
