import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { TextInput } from "./field.stylex";

const meta = {
  title: "Components/Forms/Text Input",
  component: TextInput,
  args: { placeholder: "Bottling name" },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Populated: Story = { args: { defaultValue: "Lagavulin 16" } };

export const Data: Story = {
  args: { defaultValue: "43.0", format: "data", inputMode: "decimal" },
};

export const Error: Story = {
  args: { defaultValue: "592", format: "data", invalid: true },
};

export const Disabled: Story = {
  args: { defaultValue: "Lagavulin 16", disabled: true },
};
