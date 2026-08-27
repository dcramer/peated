import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryRow } from "../storyFixtures.stylex";
import { VerdictMark } from "./scoring.stylex";

const meta = {
  title: "Components/Data Display/Verdict Mark",
  component: VerdictMark,
  args: { showLabel: true, verdict: "savor" },
  argTypes: {
    verdict: {
      control: "inline-radio",
      options: ["pass", "sip", "savor"],
    },
  },
} satisfies Meta<typeof VerdictMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Savor: Story = {};

export const Sip: Story = { args: { verdict: "sip" } };

export const Pass: Story = { args: { verdict: "pass" } };

export const Marks: Story = {
  render: () => (
    <StoryRow>
      <VerdictMark verdict="pass" />
      <VerdictMark verdict="sip" />
      <VerdictMark verdict="savor" />
    </StoryRow>
  ),
};
