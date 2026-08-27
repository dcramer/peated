"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas } from "../storyFixtures.stylex";
import { ScoreInput } from "./tastingInputs.stylex";

const meta = {
  title: "Components/Forms/Score Input",
  component: ScoreInput,
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    id: "score",
    name: "score",
    onChange: () => undefined,
    required: true,
    value: 88,
  },
} satisfies Meta<typeof ScoreInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: (args) => <ControlledScoreInput {...args} />,
};

export const Empty: Story = { args: { value: null } };

export const Extraordinary: Story = { args: { value: 97 } };

export const Disabled: Story = { args: { disabled: true } };

function ControlledScoreInput(props: React.ComponentProps<typeof ScoreInput>) {
  const [value, setValue] = useState<number | null>(props.value);
  return <ScoreInput {...props} onChange={setValue} value={value} />;
}
