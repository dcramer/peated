import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
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

export const Empty: Story = {};

export const Populated: Story = {
  args: {
    defaultValue:
      "Smoke arrives first, followed by lemon peel, brine, and a dry mineral finish.",
  },
};

export const Error: Story = {
  args: { defaultValue: "Too short", invalid: true },
};

export const Disabled: Story = {
  args: { defaultValue: "Notes cannot be changed.", disabled: true },
};
