"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import type { RatingBand } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";
import { RatingBandInput } from "./tastingInputs.stylex";

const meta = {
  title: "Components/Forms/Tasting Rating",
  component: RatingBandInput,
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    id: "rating",
    name: "rating",
    onChange: () => undefined,
    required: true,
    value: "very_good",
  },
} satisfies Meta<typeof RatingBandInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ControlledRatingBandInput {...args} />
      <RatingBandInput
        {...args}
        disabled
        id="disabled-rating"
        name="disabled-rating"
      />
    </StoryStack>
  ),
};

function ControlledRatingBandInput(
  props: React.ComponentProps<typeof RatingBandInput>,
) {
  const [value, setValue] = useState<RatingBand | null>(props.value);

  return <RatingBandInput {...props} onChange={setValue} value={value} />;
}
