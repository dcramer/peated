const env = typeof window === "undefined" ? process.env : window.CONFIG;

const config = {
  ENV: env.NODE_ENV === "production" ? "production" : "development",
  DEBUG: !!env.DEBUG,
  GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || "",
  SENTRY_DSN: env.SENTRY_DSN,
  API_SERVER: env.API_SERVER || "http://localhost:4000",

  SECRET: env.SECRET || "",

  VERSION: env.VERSION,
  GITHUB_REPO: "https://github.com/dcramer/peated",
  DISCORD_LINK: "https://discord.gg/d7GFPfy88Z",

  DESCRIPTION: "The modern spirits database.",
  THEME_COLOR: "#fbbf24",
};

export default config;
