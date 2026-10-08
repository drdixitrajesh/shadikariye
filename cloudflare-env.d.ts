declare namespace Cloudflare {
  interface Env {
    STANDALONE_MODE?: "demo";
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_VERIFY_SERVICE_SID?: string;
    OTP_HASH_SECRET?: string;
    ADMIN_USER_IDS?: string;
    ADMIN_EMAILS?: string;
  }
}
