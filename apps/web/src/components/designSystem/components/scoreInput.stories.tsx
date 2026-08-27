"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import type { RatingGrain, RatingValue } from "./scoring.stylex";
import { ScoreInput } from "./tastingInputs.stylex";

const meta = {
  title: "Components/Forms/Score Input",
  component: ScoreInput,
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    grain: "band",
    id: "score",
    name: "score",
    onChange: () => undefined,
    onGrainChange: () => undefined,
    required: true,
    value: { band: "veryGood", grain: "band" },
  },
} satisfies Meta<typeof ScoreInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ControlledScoreInput {...args} />
      <ControlledScoreInput
        {...args}
        grain="point"
        id="exact-score"
        name="exact-score"
        value={{ grain: "point", point: 88 }}
      />
      <ScoreInput
        {...args}
        disabled
        id="disabled-score"
        name="disabled-score"
      />
    </StoryStack>
  ),
};

function ControlledScoreInput(props: React.ComponentProps<typeof ScoreInput>) {
  const [grain, setGrain] = useState<RatingGrain>(props.grain);
  const [value, setValue] = useState<RatingValue>(props.value);

  function changeGrain(nextGrain: RatingGrain) {
    setGrain(nextGrain);
    setValue(null);
  }

  return (
    <ScoreInput
      {...props}
      grain={grain}
      onChange={setValue}
      onGrainChange={changeGrain}
      value={value}
    />
  );
}
