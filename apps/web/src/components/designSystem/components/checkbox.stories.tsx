import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { Checkbox } from "./checkbox.stylex";

const meta = {
  title: "Components/Forms/Checkbox",
  component: Checkbox,
  args: {
    label: "I agree to the Terms of Service.",
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };

export const WithDescription: Story = {
  args: {
    description: "You can change this later in account settings.",
  },
};

export const Disabled: Story = { args: { disabled: true } };
