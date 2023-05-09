const config = {
  ENV: import.meta.env.PROD ? "production" : "development",
  DEBUG: import.meta.env.DEV,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  SENTRY_DSN: process.env.SENTRY_DSN || "",
  API_SERVER: process.env.API_SERVER || "http://localhost:4000",

  VERSION: process.env.VERSION || "",
  GITHUB_REPO: "https://github.com/dcramer/peated",
};

export default config;
