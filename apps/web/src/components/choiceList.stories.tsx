"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { ChoiceList } from "./formControls.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const options = [
  {
    description: "Retire the selected duplicate and keep the current one.",
    label: "Keep the current one",
    value: "current",
  },
  {
    description: "Retire the current one and keep the selected duplicate.",
    label: "Keep the selected one",
    value: "other",
  },
] as const;

const meta = {
  title: "Components/Forms/Choice List",
  component: ChoiceList,
  args: {
    id: "merge-direction",
    label: "Which one should remain?",
    name: "merge-direction",
    onChange: () => undefined,
    options,
    value: "current",
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof ChoiceList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => <ControlledChoiceList {...args} />,
};

function ControlledChoiceList(props: React.ComponentProps<typeof ChoiceList>) {
  const [value, setValue] = useState(props.value);
  return <ChoiceList {...props} onChange={setValue} value={value} />;
}
