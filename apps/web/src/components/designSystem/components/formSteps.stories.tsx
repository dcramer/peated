import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { FormSteps } from "./formSteps.stylex";

const steps = [
  { label: "On the label" },
  { label: "Cask and release" },
  { label: "Photo" },
] as const;

const meta = {
  title: "Components/Forms/Form Steps",
  component: FormSteps,
  args: { current: 0, steps },
  argTypes: {
    current: { control: "inline-radio", options: [0, 1, 2] },
    steps: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof FormSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <FormSteps {...args} />
      <FormSteps current={1} steps={steps} />
      <FormSteps current={2} steps={steps} />
    </StoryStack>
  ),
};
