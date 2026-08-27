import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryRow } from "../storyFixtures.stylex";
import { CountChip } from "./chip.stylex";

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

export const Default: Story = {};

export const Neutral: Story = { args: { tone: "neutral" } };

export const Counts: Story = {
  render: () => (
    <StoryRow>
      <CountChip count={0} />
      <CountChip count={12} />
      <CountChip count={2841} />
    </StoryRow>
  ),
};
