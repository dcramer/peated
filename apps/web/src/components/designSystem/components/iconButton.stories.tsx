import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus, Search, X } from "lucide-react";

import { StoryRow } from "../storyFixtures.stylex";
import { IconButton } from "./button.stylex";

const meta = {
  title: "Components/Actions/Icon Button",
  component: IconButton,
  args: {
    icon: <Plus aria-hidden size={17} />,
    label: "Add bottle",
    size: "md",
    variant: "tonal",
  },
  argTypes: {
    icon: { control: false },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    variant: {
      control: "select",
      options: ["default", "tonal", "accent", "text"],
    },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Accent: Story = { args: { variant: "accent" } };

export const Small: Story = {
  args: { icon: <Plus aria-hidden size={14} />, size: "sm" },
};

export const Large: Story = {
  args: {
    icon: <Plus aria-hidden size={20} />,
    size: "lg",
    variant: "accent",
  },
};

export const Disabled: Story = { args: { disabled: true } };

export const CommonActions: Story = {
  render: () => (
    <StoryRow>
      <IconButton icon={<Search aria-hidden size={17} />} label="Search" />
      <IconButton
        icon={<Plus aria-hidden size={17} />}
        label="Add bottle"
        variant="accent"
      />
      <IconButton
        icon={<X aria-hidden size={17} />}
        label="Close"
        variant="text"
      />
    </StoryRow>
  ),
};
