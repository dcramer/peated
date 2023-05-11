const config = {
  ENV: import.meta.env.PROD ? "production" : "development",
  DEBUG: import.meta.env.DEV,
  GOOGLE_CLIENT_ID: import.meta.env.GOOGLE_CLIENT_ID || "",
  SENTRY_DSN: import.meta.env.SENTRY_DSN || "",
  API_SERVER: import.meta.env.API_SERVER || "http://localhost:4000",

  VERSION: import.meta.env.VERSION || "",
  GITHUB_REPO: "https://github.com/dcramer/peated",
};

export default config;
