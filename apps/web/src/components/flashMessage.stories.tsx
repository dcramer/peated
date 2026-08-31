import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FlashMessage } from "./feedback.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Messages & Status/Flash Message",
  component: FlashMessage,
  args: {
    children: "Your tasting was saved.",
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof FlashMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <FlashMessage {...args} tone="success" />
      <FlashMessage tone="info">
        The bottle was added to your Library.
      </FlashMessage>
      <FlashMessage tone="error">We could not save that tasting.</FlashMessage>
    </StoryStack>
  ),
};
