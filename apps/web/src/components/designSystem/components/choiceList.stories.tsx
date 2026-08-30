"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas } from "../storyFixtures.stylex";
import { ChoiceList } from "./formControls.stylex";

const options = [
  {
    description: "Retire the selected duplicate and keep the current record.",
    label: "Keep this record",
    value: "current",
  },
  {
    description: "Retire the current record and keep the selected duplicate.",
    label: "Keep the selected record",
    value: "other",
  },
] as const;

const meta = {
  title: "Components/Forms/Choice List",
  component: ChoiceList,
  args: {
    id: "merge-direction",
    label: "Merge direction",
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
