use argon2::{Argon2, PasswordHasher, password_hash::{SaltString, rand_core::OsRng}};
use reqwest::Client;
use sqlx::PgPool;
use std::env;
use std::time::Duration;

#[derive(Clone)]
pub struct Config {
    pub openai_api_key: String,
    pub openai_api_url: String,
    pub port: u16,
    pub allowed_origins: Vec<String>,
    pub db: Option<PgPool>,
    pub dashboard_user: String,
    pub dashboard_password_hash: String,
    pub http_client: Client,
    pub max_tokens: u32,
    pub semester_salt: String,
}

impl Config {
    pub async fn from_env() -> Result<Self, String> {
        dotenvy::dotenv().ok();

        let openai_api_key = env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY must be set");
        let openai_api_url = env::var("OPENAI_API_URL").expect("OPENAI_API_URL must be set");

        let port = env::var("PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .expect("PORT must be a valid number");

        let allowed_origins = env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "Any".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        let dashboard_user =
            env::var("DASHBOARD_USER").unwrap_or_else(|_| "admin".to_string());

        // Accept a pre-computed hash, or hash the plaintext password at startup
        let dashboard_password_hash = match env::var("DASHBOARD_PASSWORD_HASH") {
            Ok(hash) => hash,
            Err(_) => {
                let password = env::var("DASHBOARD_PASSWORD")
                    .expect("Either DASHBOARD_PASSWORD or DASHBOARD_PASSWORD_HASH must be set");
                let salt = SaltString::generate(&mut OsRng);
                Argon2::default()
                    .hash_password(password.as_bytes(), &salt)
                    .expect("Failed to hash dashboard password")
                    .to_string()
            }
        };

        let db = Self::init_db().await;

        let semester_salt = env::var("SEMESTER").unwrap_or_else(|_| {
            tracing::warn!(
                "SEMESTER not set — telemetry user IDs will not rotate between deployments"
            );
            String::new()
        });

        let max_tokens: u32 = env::var("MAX_TOKENS")
            .unwrap_or_else(|_| "10000".to_string())
            .parse()
            .expect("MAX_TOKENS must be a valid number");

        let request_timeout: u64 = env::var("REQUEST_TIMEOUT_SECS")
            .unwrap_or_else(|_| "240".to_string())
            .parse()
            .expect("REQUEST_TIMEOUT_SECS must be a valid number");

        let http_client = Client::builder()
            .timeout(Duration::from_secs(request_timeout))
            .build()
            .expect("Failed to create HTTP client");

        Ok(Self {
            openai_api_key,
            openai_api_url,
            port,
            allowed_origins,
            db,
            dashboard_user,
            dashboard_password_hash,
            http_client,
            max_tokens,
            semester_salt,
        })
    }

    async fn init_db() -> Option<PgPool> {
        match env::var("DATABASE_URL") {
            Ok(url) => {
                let pool = PgPool::connect(&url)
                    .await
                    .expect("Failed to connect to database");
                tracing::info!("Connected to PostgreSQL");
                Some(pool)
            }
            Err(_) => {
                tracing::info!("DATABASE_URL not set — telemetry disabled");
                None
            }
        }
    }
}
