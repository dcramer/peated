import "@fontsource-variable/karla";
import "@fontsource-variable/space-grotesk";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

import type { Preview } from "@storybook/nextjs-vite";

import "./preview.css";
import { StorybookTheme } from "./storybookTheme.stylex";
import { peatedViewports } from "./viewports";

const preview: Preview = {
  tags: ["autodocs"],
  globalTypes: {
    theme: {
      description: "Color scheme",
      toolbar: {
        icon: "mirror",
        items: [
          { title: "Light", value: "light" },
          { title: "Dark", value: "dark" },
        ],
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  decorators: [
    (Story, context) => (
      <StorybookTheme theme={context.globals.theme}>
        <Story />
      </StorybookTheme>
    ),
  ],
  parameters: {
    a11y: {
      test: "todo",
    },
    layout: "fullscreen",
    options: {
      storySort: {
        order: [
          "Foundations",
          "Components",
          [
            "Actions",
            "Forms",
            "Selection",
            "Identity",
            "Ratings",
            "Data Display",
            "Layout",
            "Editorial",
            "Feedback",
            "Navigation",
            "Bottle",
            "Entities",
            "Profile",
            "Search",
          ],
          "Pages",
        ],
      },
    },
    viewport: {
      options: peatedViewports,
    },
  },
};

export default preview;
