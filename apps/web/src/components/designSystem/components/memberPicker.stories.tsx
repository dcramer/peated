"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas } from "../storyFixtures.stylex";
import { MemberPicker, type MemberPickerOption } from "./memberPicker.stylex";
import { memberOptions } from "./storyData";

const meta = {
  title: "Components/Selection/Member Picker",
  component: MemberPicker,
  args: {
    onChange: () => undefined,
    options: memberOptions,
    value: [],
  },
  argTypes: {
    onChange: { control: false },
    options: { control: false },
    value: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof MemberPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Search: Story = {
  render: (args) => <ControlledMemberPicker {...args} />,
};

export const Selected: Story = {
  args: { value: [memberOptions[0]] },
  render: (args) => <ControlledMemberPicker {...args} />,
};

function ControlledMemberPicker(
  props: React.ComponentProps<typeof MemberPicker>,
) {
  const [value, setValue] = useState<readonly MemberPickerOption[]>(
    props.value,
  );
  return <MemberPicker {...props} onChange={setValue} value={value} />;
}
