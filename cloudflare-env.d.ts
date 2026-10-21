declare namespace Cloudflare {
  interface Env {
    STANDALONE_MODE?: "demo" | "test-portal";
    PUBLIC_REGISTRATION?: string;
    REQUIRE_ACCOUNT_MOBILE?: string;
    PHOTO_PROTECTION?: {render:(body:ArrayBuffer,viewerTag:string)=>Promise<ArrayBuffer>};
    PORTAL_KEY?: string;
    PASSWORD_SERVICE?: DurableObjectNamespace;
    DEPLOYMENT_SHA?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
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
