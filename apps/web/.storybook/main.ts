import type { StorybookConfig } from "@storybook/nextjs-vite";
import stylex from "@stylexjs/unplugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-mcp"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
    disableWhatsNewNotifications: true,
  },
  features: {
    actions: false,
    backgrounds: false,
    controls: true,
    highlight: false,
    interactions: false,
    measure: false,
    menuOnboardingChecklist: false,
    outline: false,
    sidebarOnboardingChecklist: false,
  },
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  async viteFinal(config) {
    config.plugins = [
      stylex.vite({
        devMode: "full",
        enableInlinedConditionalMerge: true,
        runtimeInjection: false,
        treeshakeCompensation: true,
        unstable_moduleResolution: {
          type: "commonJS",
          rootDir: webRoot,
        },
      }),
      ...(config.plugins ?? []),
    ];

    return config;
  },
};

export default config;
