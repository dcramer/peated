"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";
import { ReviewScoreInput } from "./tastingInputs.stylex";

const meta = {
  title: "Components/Forms/Review Score Input",
  component: ReviewScoreInput,
  args: {
    id: "review-score",
    name: "score",
    value: 89,
    required: true,
    onChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Drag or tap the 60–100 score scale, or use arrow keys while it is focused. Typing and the increment buttons support the full 0–100 range. The slider does not assign a score until used.",
      },
    },
  },
} satisfies Meta<typeof ReviewScoreInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ControlledScore key={args.value} {...args} />
      <ControlledScore
        {...args}
        id="empty-score"
        name="empty-score"
        value={null}
      />
      <ReviewScoreInput
        {...args}
        id="disabled-score"
        name="disabled-score"
        disabled
      />
    </StoryStack>
  ),
};

function ControlledScore(props: React.ComponentProps<typeof ReviewScoreInput>) {
  const [value, setValue] = useState<number | null>(props.value);
  return <ReviewScoreInput {...props} value={value} onChange={setValue} />;
}
