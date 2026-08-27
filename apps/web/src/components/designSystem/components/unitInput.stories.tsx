import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
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
        <Field htmlFor="unit-input" label="ABV">
          <Story />
        </Field>
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof UnitInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Years: Story = {
  args: { defaultValue: 16, unit: "yr" },
};

export const Invalid: Story = {
  args: {
    "aria-describedby": "unit-error",
    defaultValue: 592,
    invalid: true,
  },
  decorators: [
    (Story) => (
      <div>
        <Story />
        <ValidationMessage id="unit-error">
          Did you mean 59.2?
        </ValidationMessage>
      </div>
    ),
  ],
};
