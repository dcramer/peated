"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import {
  ProducerPicker,
  type ProducerPickerOption,
} from "./producerPicker.stylex";
import { distillerOptions } from "./storyData";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Catalog/Brand and Producer Picker",
  component: ProducerPicker,
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
} satisfies Meta<typeof ProducerPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Search: Story = {
  render: (args) => (
    <StoryStack>
      <ControlledProducerPicker {...args} />
      <ControlledProducerPicker
        {...args}
        error="Brand is required."
        kind="brand"
        required
      />
    </StoryStack>
  ),
};

export const Selected: Story = {
  args: { value: distillerOptions[0] },
  render: (args) => <ControlledProducerPicker {...args} />,
};

export const WithCreateHandoff: Story = {
  render: (args) => (
    <ControlledProducerPicker {...args} onCreate={() => undefined} />
  ),
};

function ControlledProducerPicker(
  props: React.ComponentProps<typeof ProducerPicker>,
) {
  const [value, setValue] = useState<ProducerPickerOption | null>(props.value);
  return <ProducerPicker {...props} onChange={setValue} value={value} />;
}
