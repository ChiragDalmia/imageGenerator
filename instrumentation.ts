// Validates required environment variables when the server boots, so a
// misconfigured deployment fails immediately with a clear message instead of
// erroring on the first request that happens to need the missing value.
export async function register() {
  // Skip during `next build` — env vars may legitimately be absent there.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const required = [
    "MONGODB_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "WEBHOOK_SECRET",
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_SERVER_URL",
  ];

  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "See .env.example for the full list."
    );
  }
}
