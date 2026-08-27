import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { Textarea } from "./field.stylex";

const meta = {
  title: "Components/Forms/Textarea",
  component: Textarea,
  args: { placeholder: "What stood out?" },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <Textarea {...args} />
      <Textarea defaultValue="Smoke arrives first, followed by lemon peel, brine, and a dry mineral finish." />
      <Textarea defaultValue="Too short" invalid />
      <Textarea defaultValue="Notes cannot be changed." disabled />
    </StoryStack>
  ),
};
