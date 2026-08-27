import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryRow } from "../storyFixtures.stylex";
import { Button } from "./button.stylex";

const meta = {
  title: "Components/Actions/Button",
  component: Button,
  args: {
    children: "Record a bottle",
    size: "md",
    variant: "default",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    variant: {
      control: "select",
      options: ["default", "tonal", "accent", "text"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tonal: Story = {
  args: { children: "Browse database", variant: "tonal" },
};

export const Accent: Story = {
  args: { children: "Save tasting", variant: "accent" },
};

export const Text: Story = {
  args: { children: "Record this bottle", variant: "text" },
};

export const Small: Story = { args: { size: "sm", variant: "tonal" } };

export const Large: Story = { args: { size: "lg", variant: "accent" } };

export const Loading: Story = {
  args: {
    children: "Save tasting",
    loading: true,
    loadingLabel: "Saving your tasting",
    variant: "accent",
  },
};

export const LoadingSizes: Story = {
  render: () => (
    <StoryRow>
      {(["sm", "md", "lg"] as const).map((size) => (
        <Button
          key={size}
          loading
          loadingLabel="Saving your tasting"
          size={size}
          variant="accent"
        >
          Save tasting
        </Button>
      ))}
    </StoryRow>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, variant: "accent" },
};
