import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { Field, ValidationMessage } from "./field.stylex";
import { UnitInput } from "./unitInput.stylex";

const meta = {
  title: "Components/Forms/Unit Input",
  component: UnitInput,
  args: {
    defaultValue: 43,
    id: "unit-input",
    unit: "%",
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof UnitInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <Field htmlFor="unit-input" label="ABV">
        <UnitInput {...args} />
      </Field>
      <Field htmlFor="age-input" label="Age">
        <UnitInput defaultValue={16} id="age-input" unit="years" />
      </Field>
      <Field htmlFor="invalid-unit-input" label="ABV">
        <UnitInput
          aria-describedby="unit-error"
          defaultValue={592}
          id="invalid-unit-input"
          invalid
          unit="%"
        />
        <ValidationMessage id="unit-error">
          Did you mean 59.2?
        </ValidationMessage>
      </Field>
    </StoryStack>
  ),
};
