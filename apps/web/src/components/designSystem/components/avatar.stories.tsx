import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryRow } from "../storyFixtures.stylex";
import { Avatar } from "./avatar.stylex";

const meta = {
  title: "Components/Identity/Avatar",
  component: Avatar,
  args: {
    initials: "DC",
    size: "md",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["xs", "sm", "md"] },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryRow>
      <Avatar {...args} size="xs" />
      <Avatar {...args} size="sm" />
      <Avatar {...args} size="md" />
    </StoryRow>
  ),
};
