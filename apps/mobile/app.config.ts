import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "peated",
  slug: "peated",
  scheme: "peated",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./src/assets/images/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./src/assets/images/glyph.png",
    resizeMode: "contain",
    backgroundColor: "#020617",
  },
  jsEngine: "hermes",
  ios: {
    bundleIdentifier: "com.peated.app",
    supportsTablet: true,
  },
  android: {
    package: "com.peated.app",
    adaptiveIcon: {
      foregroundImage: "./src/assets/images/glyph.png",
      backgroundColor: "#020617",
    },
  },
  web: {
    bundler: "metro",
    output: "static",
  },
  experiments: {
    tsconfigPaths: true,
    typedRoutes: true,
  },
  plugins: [
    "expo-router",
    [
      "@sentry/react-native/expo",
      {
        organization:
          "sentry org slug, or use the `SENTRY_ORG` environment variable",
        project:
          "sentry project name, or use the `SENTRY_PROJECT` environment variable",
      },
    ],
  ],
});
