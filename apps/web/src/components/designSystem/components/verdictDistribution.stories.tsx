import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { VerdictDistribution } from "./scoring.stylex";

const meta = {
  title: "Components/Data Display/Verdict Distribution",
  component: VerdictDistribution,
  args: { pass: 256, sip: 824, savor: 1761 },
  argTypes: {
    pass: { control: { min: 0, step: 1, type: "number" } },
    sip: { control: { min: 0, step: 1, type: "number" } },
    savor: { control: { min: 0, step: 1, type: "number" } },
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof VerdictDistribution>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const SmallSample: Story = { args: { pass: 2, sip: 3, savor: 7 } };

export const Empty: Story = { args: { pass: 0, sip: 0, savor: 0 } };
