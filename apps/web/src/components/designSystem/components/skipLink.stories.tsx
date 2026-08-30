import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { SkipLink } from "./skipLink.stylex";

const meta = {
  title: "Components/Navigation/Skip Link",
  component: SkipLink,
  args: {
    children: "Skip to content",
    href: "#story-content",
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
        <main id="story-content">Page content</main>
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof SkipLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Focused: Story = {
  parameters: { pseudo: { focus: true } },
};
