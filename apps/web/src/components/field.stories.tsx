import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Field, TextInput } from "./field.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Forms/Field",
  component: Field,
  args: {
    children: <TextInput id="bottle-name" placeholder="Bottle name" />,
    htmlFor: "bottle-name",
    label: "Bottle name",
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
      <Field htmlFor="required-bottle-name" label="Bottle name" required>
        <TextInput id="required-bottle-name" placeholder="Bottle name" />
      </Field>
      <Field
        hint="The name printed on the bottle."
        htmlFor="optional-bottle-name"
        label="Bottle name"
        optional
      >
        <TextInput id="optional-bottle-name" placeholder="Bottle name" />
      </Field>
      <Field
        error="Check the spelling before publishing."
        errorId="bottle-name-error"
        htmlFor="bottle-name-error-input"
        label="Bottle name"
        required
      >
        <TextInput
          aria-describedby="bottle-name-error"
          defaultValue="Lagavln"
          id="bottle-name-error-input"
          invalid
        />
      </Field>
    </StoryStack>
  ),
};
