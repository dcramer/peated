"use client";

import { mockBottles } from "@peated/server/orpc/mock/fixtures";
import { toBottlePickerOption } from "@peated/web/lib/bottleListItem";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import {
  SearchPicker,
  SearchSelect,
  type SearchPickerOption,
} from "./searchPicker.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const options = mockBottles.slice(0, 3).map(toBottlePickerOption);

const meta = {
  title: "Components/Search/Search Picker",
  component: SearchPicker,
  args: {
    label: "Bottles",
    onChange: () => undefined,
    options,
    placeholder: "Search bottles",
    value: [],
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof SearchPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ControlledSelect {...args} />
      <ControlledPicker {...args} />
    </StoryStack>
  ),
};

function ControlledSelect(props: React.ComponentProps<typeof SearchPicker>) {
  const [value, setValue] = useState<SearchPickerOption | null>(options[0]!);
  return (
    <SearchSelect {...props} label="Bottle" onChange={setValue} value={value} />
  );
}

function ControlledPicker(props: React.ComponentProps<typeof SearchPicker>) {
  const [value, setValue] = useState<readonly SearchPickerOption[]>([
    options[0]!,
  ]);
  return <SearchPicker {...props} onChange={setValue} value={value} />;
}
