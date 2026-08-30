"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { ColourInput } from "./tastingInputs.stylex";

const meta = {
  title: "Components/Forms/Colour Input",
  component: ColourInput,
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    id: "colour",
    name: "colour",
    onChange: () => undefined,
    value: 10,
  },
} satisfies Meta<typeof ColourInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ControlledColourInput {...args} />
      <ControlledColourInput
        {...args}
        id="unsure-colour"
        name="unsure-colour"
        value={null}
      />
      <ControlledColourInput
        {...args}
        id="dark-colour"
        name="dark-colour"
        value={19}
      />
      <ColourInput
        {...args}
        disabled
        id="disabled-colour"
        name="disabled-colour"
      />
    </StoryStack>
  ),
};

function ControlledColourInput(
  props: React.ComponentProps<typeof ColourInput>,
) {
  const [value, setValue] = useState<number | null>(props.value);
  return <ColourInput {...props} onChange={setValue} value={value} />;
}
