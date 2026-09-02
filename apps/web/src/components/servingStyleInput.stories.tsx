"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";
import { ServingStyleInput, type ServingStyle } from "./tastingInputs.stylex";

const meta = {
  title: "Components/Forms/Serving Style",
  component: ServingStyleInput,
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    id: "serving",
    name: "servingStyle",
    onChange: () => undefined,
    value: "neat",
  },
} satisfies Meta<typeof ServingStyleInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ControlledServingStyleInput {...args} />
      <ServingStyleInput
        {...args}
        disabled
        id="disabled-serving"
        name="disabled-serving"
      />
    </StoryStack>
  ),
};

function ControlledServingStyleInput(
  props: React.ComponentProps<typeof ServingStyleInput>,
) {
  const [value, setValue] = useState<ServingStyle | null>(props.value);

  return <ServingStyleInput {...props} onChange={setValue} value={value} />;
}
