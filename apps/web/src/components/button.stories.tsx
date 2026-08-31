import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button.stylex";
import { StoryRow, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Buttons & Menus/Button",
  component: Button,
  args: {
    children: "Add a bottle",
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
  parameters: {
    docs: {
      description: {
        component:
          "Use Button for actions and ButtonLink for navigation with the same treatment. Choose one accent action per view; use default or tonal variants for supporting actions.",
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <StoryRow>
        <Button {...args} />
        <Button variant="tonal">Browse database</Button>
        <Button variant="accent">Save tasting</Button>
        <Button variant="text">Add this bottle</Button>
      </StoryRow>
      <StoryRow>
        {(["sm", "md", "lg"] as const).map((size) => (
          <Button key={size} size={size} variant="accent">
            Save tasting
          </Button>
        ))}
      </StoryRow>
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
        <Button disabled variant="accent">
          Save tasting
        </Button>
      </StoryRow>
    </StoryStack>
  ),
};
