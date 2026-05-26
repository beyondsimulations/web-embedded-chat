use sha2::{Digest, Sha256};
use std::net::IpAddr;

pub fn hash_user_id(ip: IpAddr) -> String {
    let mut hasher = Sha256::new();
    hasher.update(ip.to_string());
    format!("{:x}", hasher.finalize())
}
