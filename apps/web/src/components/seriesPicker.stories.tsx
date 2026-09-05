"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { SeriesPicker, type SeriesPickerOption } from "./seriesPicker.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const options: SeriesPickerOption[] = [
  { id: "1", name: "Distillers Edition", brand: "Lagavulin" },
  { id: "2", name: "Jazz Festival", brand: "Lagavulin" },
];

const meta = {
  title: "Components/Catalog/Series Picker",
  component: SeriesPicker,
  args: {
    onChange: () => undefined,
    options,
    value: null,
  },
  argTypes: {
    onChange: { control: false },
    onCreate: { control: false },
    options: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof SeriesPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ControlledSeriesPicker {...args} onCreate={() => undefined} />
      <SeriesPicker {...args} loading />
      <SeriesPicker
        {...args}
        searchError="Unable to search Series. Keep typing or try again."
      />
    </StoryStack>
  ),
};

function ControlledSeriesPicker(
  props: React.ComponentProps<typeof SeriesPicker>,
) {
  const [value, setValue] = useState<SeriesPickerOption | null>(props.value);
  return <SeriesPicker {...props} onChange={setValue} value={value} />;
}
