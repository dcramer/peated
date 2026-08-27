import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { LoadingPlaceholder } from "./feedback.stylex";

const meta = {
  title: "Components/Feedback/Loading Placeholder",
  component: LoadingPlaceholder,
  args: { delay: 0, preset: "text" },
  argTypes: {
    delay: { control: "inline-radio", options: [0, 1, 2, 3, 4] },
    preset: {
      control: "select",
      options: ["heading", "metadata", "score", "text", "thumbnail"],
    },
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof LoadingPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {};

export const Heading: Story = { args: { preset: "heading" } };

export const Metadata: Story = { args: { preset: "metadata" } };

export const Score: Story = { args: { preset: "score" } };

export const Thumbnail: Story = { args: { preset: "thumbnail" } };

export const TextModule: Story = {
  render: () => (
    <StoryStack>
      <LoadingPlaceholder preset="heading" />
      <LoadingPlaceholder delay={1} preset="text" />
      <LoadingPlaceholder delay={2} preset="text" />
      <LoadingPlaceholder delay={3} preset="metadata" />
    </StoryStack>
  ),
};
