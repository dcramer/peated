"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas } from "../storyFixtures.stylex";
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

export const Interactive: Story = {
  render: (args) => <ControlledColourInput {...args} />,
};

export const Unsure: Story = { args: { value: null } };

export const DarkColour: Story = { args: { value: 19 } };

export const Disabled: Story = { args: { disabled: true } };

function ControlledColourInput(
  props: React.ComponentProps<typeof ColourInput>,
) {
  const [value, setValue] = useState<number | null>(props.value);
  return <ColourInput {...props} onChange={setValue} value={value} />;
}
