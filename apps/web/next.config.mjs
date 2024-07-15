import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  env: {
    DEBUG: process.env.DEBUG ? "true" : "",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
    SENTRY_DSN: process.env.SENTRY_DSN,
    API_SERVER: process.env.API_SERVER || "http://localhost:4000",
    FATHOM_SITE_ID: process.env.FATHOM_SITE_ID,
    URL_PREFIX: process.env.URL_PREFIX || "http://localhost:3000",

    VERSION: process.env.VERSION || process.env.VERCEL_GIT_COMMIT_SHA,
    GITHUB_REPO: "https://github.com/dcramer/peated",
    DISCORD_LINK: "https://discord.gg/d7GFPfy88Z",
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "peated",
  project: "peated",

  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,

  env: {},
});
