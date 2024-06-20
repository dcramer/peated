const config = {
  ENV: process.env.NODE_ENV === "production" ? "production" : "development",
  DEBUG: !!process.env.DEBUG,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  SENTRY_DSN: process.env.SENTRY_DSN,
  API_SERVER: process.env.API_SERVER || "http://localhost:4000",
  FATHOM_SITE_ID: process.env.FATHOM_SITE_ID,

  VERSION: process.env.VERSION,
  GITHUB_REPO: "https://github.com/dcramer/peated",
  DISCORD_LINK: "https://discord.gg/d7GFPfy88Z",

  DESCRIPTION:
    "Peated is a spirits database allowing anyone to record tasting notes, track their favorite whiskies, and discover the world of peat.",
  THEME_COLOR: "#fbbf24",
};

export default config;
