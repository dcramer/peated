const config = {
  ENV: import.meta.env.PROD ? "production" : "development",
  DEBUG: import.meta.env.DEV,
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN || "",
  API_SERVER: import.meta.env.VITE_API_HOST || "http://localhost:4000",
  GITHUB_REPO: "https://github.com/dcramer/peated",
};

export default config;
