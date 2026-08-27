import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { Field, TextInput } from "./field.stylex";

const meta = {
  title: "Components/Forms/Field",
  component: Field,
  args: {
    children: <TextInput id="bottling-name" placeholder="Bottling name" />,
    htmlFor: "bottling-name",
    label: "Bottling name",
  },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Required: Story = { args: { required: true } };

export const OptionalWithHint: Story = {
  args: {
    hint: "The name printed on the bottle.",
    optional: true,
  },
};

export const Error: Story = {
  args: {
    children: (
      <TextInput
        aria-describedby="bottling-name-error"
        defaultValue="Lagavln"
        id="bottling-name-error-input"
        invalid
      />
    ),
    error: "Check the spelling before publishing.",
    errorId: "bottling-name-error",
    htmlFor: "bottling-name-error-input",
    required: true,
  },
};
