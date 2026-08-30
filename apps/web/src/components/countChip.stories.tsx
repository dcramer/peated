import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CountChip } from "./chip.stylex";
import { StoryRow } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Selection/Count Chip",
  component: CountChip,
  args: { count: 12, tone: "accent" },
  argTypes: {
    tone: { control: "inline-radio", options: ["accent", "neutral"] },
  },
} satisfies Meta<typeof CountChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryRow>
      <CountChip {...args} />
      <CountChip count={0} />
      <CountChip count={2841} />
      <CountChip count={12} tone="neutral" />
    </StoryRow>
  ),
};
