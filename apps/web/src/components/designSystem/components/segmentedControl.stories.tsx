"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { SegmentedControl } from "./formControls.stylex";

const options = [
  { label: "Neat", value: "neat" },
  { label: "Water", value: "water" },
  { label: "Ice", value: "ice" },
] as const;

const meta = {
  title: "Components/Forms/Segmented Control",
  component: SegmentedControl,
  args: {
    id: "served",
    label: "Served",
    name: "served",
    onChange: () => undefined,
    options,
    value: "neat",
  },
  argTypes: { onChange: { control: false }, options: { control: false } },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ControlledSegmentedControl {...args} />
      <SegmentedControl
        {...args}
        disabled
        id="disabled-served"
        name="disabled-served"
      />
    </StoryStack>
  ),
};

function ControlledSegmentedControl(
  props: React.ComponentProps<typeof SegmentedControl>,
) {
  const [value, setValue] = useState(props.value);
  return <SegmentedControl {...props} onChange={setValue} value={value} />;
}
