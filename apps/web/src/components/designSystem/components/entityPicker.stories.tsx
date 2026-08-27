"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas } from "../storyFixtures.stylex";
import { EntityPicker, type EntityPickerOption } from "./entityPicker.stylex";
import { distillerOptions } from "./storyData";

const meta = {
  title: "Components/Selection/Entity Picker",
  component: EntityPicker,
  args: {
    kind: "distiller",
    onChange: () => undefined,
    options: distillerOptions,
    value: null,
  },
  argTypes: {
    onChange: { control: false },
    onCreate: { control: false },
    options: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof EntityPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Search: Story = {
  render: (args) => <ControlledEntityPicker {...args} />,
};

export const Selected: Story = {
  args: { value: distillerOptions[0] },
  render: (args) => <ControlledEntityPicker {...args} />,
};

export const WithCreateHandoff: Story = {
  render: (args) => (
    <ControlledEntityPicker {...args} onCreate={() => undefined} />
  ),
};

function ControlledEntityPicker(
  props: React.ComponentProps<typeof EntityPicker>,
) {
  const [value, setValue] = useState<EntityPickerOption | null>(props.value);
  return <EntityPicker {...props} onChange={setValue} value={value} />;
}
