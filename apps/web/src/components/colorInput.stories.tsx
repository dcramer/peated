"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";
import { ColorInput } from "./tastingInputs.stylex";

const meta = {
  title: "Components/Forms/Color Input",
  component: ColorInput,
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    id: "color",
    name: "color",
    onChange: () => undefined,
    value: 10,
  },
} satisfies Meta<typeof ColorInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ControlledColorInput {...args} />
      <ControlledColorInput
        {...args}
        id="unsure-color"
        name="unsure-color"
        value={null}
      />
      <ControlledColorInput
        {...args}
        id="dark-color"
        name="dark-color"
        value={19}
      />
      <ColorInput
        {...args}
        disabled
        id="disabled-color"
        name="disabled-color"
      />
    </StoryStack>
  ),
};

function ControlledColorInput(props: React.ComponentProps<typeof ColorInput>) {
  const [value, setValue] = useState<number | null>(props.value);
  return <ColorInput {...props} onChange={setValue} value={value} />;
}
