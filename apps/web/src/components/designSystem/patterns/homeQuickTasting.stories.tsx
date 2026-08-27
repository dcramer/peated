import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { QuickTastingPrompt } from "./homeWidgets.stylex";

const meta = {
  title: "Patterns/Home/Quick Tasting",
  component: QuickTastingPrompt,
  args: {
    bottles: [
      { href: "#lagavulin", name: "Lagavulin 16" },
      { href: "#springbank", name: "Springbank 15" },
      { href: "#ardbeg", name: "Ardbeg Uigeadail" },
    ],
    scanHref: "#scan",
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof QuickTastingPrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithShelfBottles: Story = {};

export const EmptyShelf: Story = {
  args: { bottles: [] },
};
