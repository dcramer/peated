"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { Switch } from "./formControls.stylex";

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

export const On: Story = {
  render: (args) => <ControlledSwitch {...args} />,
};

export const Off: Story = { args: { checked: false } };

export const WithDescription: Story = {
  args: {
    description:
      "Off means the tasting still counts, but only you see the note.",
  },
  render: (args) => <ControlledSwitch {...args} />,
};

export const Disabled: Story = { args: { disabled: true } };

function ControlledSwitch(props: React.ComponentProps<typeof Switch>) {
  const [checked, setChecked] = useState(props.checked);
  return <Switch {...props} checked={checked} onCheckedChange={setChecked} />;
}
