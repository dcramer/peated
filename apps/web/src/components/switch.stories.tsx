"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { Switch } from "./formControls.stylex";
import { StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Forms/Switch",
  component: Switch,
  args: {
    checked: true,
    label: "Share to friends",
    name: "share-to-friends",
    onCheckedChange: () => undefined,
  },
  argTypes: { onCheckedChange: { control: false } },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ControlledSwitch {...args} />
      <ControlledSwitch {...args} checked={false} name="private-tasting" />
      <ControlledSwitch
        {...args}
        checked={false}
        description="Off means the tasting still counts, but only you see the note."
        name="described-sharing"
      />
      <Switch {...args} disabled name="disabled-sharing" />
    </StoryStack>
  ),
};

function ControlledSwitch(props: React.ComponentProps<typeof Switch>) {
  const [checked, setChecked] = useState(props.checked);
  return <Switch {...props} checked={checked} onCheckedChange={setChecked} />;
}
