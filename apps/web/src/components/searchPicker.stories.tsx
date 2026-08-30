"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import {
  SearchPicker,
  SearchSelect,
  type SearchPickerOption,
} from "./searchPicker.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const options = [
  { id: 1, label: "Lagavulin 16-year-old", detail: "Islay · 43% ABV" },
  { id: 2, label: "Laphroaig 10-year-old", detail: "Islay · 40% ABV" },
  { id: 3, label: "Springbank 10-year-old", detail: "Campbeltown · 46% ABV" },
] satisfies SearchPickerOption[];

const meta = {
  title: "Components/Selection/Search Picker",
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
