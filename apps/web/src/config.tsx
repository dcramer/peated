const config = {
  ENV: import.meta.env.PROD ? "production" : "development",
  DEBUG: import.meta.env.DEV,
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN || "",
  API_SERVER: import.meta.env.VITE_API_SERVER || "http://localhost:4000",

  VERSION: import.meta.env.VITE_VERSION || "",
  GITHUB_REPO: "https://github.com/dcramer/peated",
  DISCORD_LINK: "https://discord.gg/d7GFPfy88Z",
};

export default config;
