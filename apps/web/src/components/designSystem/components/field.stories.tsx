import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
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

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <Field {...args} />
      <Field htmlFor="required-bottling-name" label="Bottling name" required>
        <TextInput id="required-bottling-name" placeholder="Bottling name" />
      </Field>
      <Field
        hint="The name printed on the bottle."
        htmlFor="optional-bottling-name"
        label="Bottling name"
        optional
      >
        <TextInput id="optional-bottling-name" placeholder="Bottling name" />
      </Field>
      <Field
        error="Check the spelling before publishing."
        errorId="bottling-name-error"
        htmlFor="bottling-name-error-input"
        label="Bottling name"
        required
      >
        <TextInput
          aria-describedby="bottling-name-error"
          defaultValue="Lagavln"
          id="bottling-name-error-input"
          invalid
        />
      </Field>
    </StoryStack>
  ),
};
