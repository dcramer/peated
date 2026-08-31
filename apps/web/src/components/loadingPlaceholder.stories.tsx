import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LoadingPlaceholder } from "./feedback.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Messages & Status/Loading Placeholder",
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

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <LoadingPlaceholder {...args} />
      <LoadingPlaceholder preset="heading" />
      <LoadingPlaceholder preset="metadata" />
      <LoadingPlaceholder preset="score" />
      <LoadingPlaceholder preset="thumbnail" />
      <LoadingPlaceholder preset="heading" />
      <LoadingPlaceholder delay={1} preset="text" />
      <LoadingPlaceholder delay={2} preset="text" />
      <LoadingPlaceholder delay={3} preset="metadata" />
    </StoryStack>
  ),
};
