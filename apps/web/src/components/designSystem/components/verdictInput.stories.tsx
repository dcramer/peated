"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas } from "../storyFixtures.stylex";
import type { Verdict } from "./scoring.stylex";
import { VerdictInput } from "./tastingInputs.stylex";

const meta = {
  title: "Components/Forms/Verdict Input",
  component: VerdictInput,
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    id: "verdict",
    name: "verdict",
    onChange: () => undefined,
    value: null,
  },
} satisfies Meta<typeof VerdictInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: (args) => <ControlledVerdictInput {...args} />,
};

export const SavorSelected: Story = {
  args: { value: "savor" },
};

export const Disabled: Story = {
  args: { disabled: true, value: "sip" },
};

function ControlledVerdictInput(
  props: React.ComponentProps<typeof VerdictInput>,
) {
  const [value, setValue] = useState<Verdict | null>(props.value);
  return <VerdictInput {...props} onChange={setValue} value={value} />;
}
