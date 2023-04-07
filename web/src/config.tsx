const config = {
  ENV: import.meta.env.NODE_ENV || "production",
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  SENTRY_DSN: import.meta.env.SENTRY_DSN || "",
};

export default config;
