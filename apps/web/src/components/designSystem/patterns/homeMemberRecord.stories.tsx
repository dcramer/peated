import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { MemberRecordSummary } from "./homeWidgets.stylex";

const meta = {
  title: "Patterns/Home/Member Record",
  component: MemberRecordSummary,
  args: {
    facts: [
      { label: "On the shelf", value: 34 },
      { label: "Bottles tasted", value: 87 },
      { label: "Contributions", value: 12 },
    ],
    ratings: { pass: 12, savor: 54, sip: 34 },
    totalTastings: 128,
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof MemberRecordSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const NewMember: Story = {
  args: {
    facts: [
      { label: "On the shelf", value: 0 },
      { label: "Bottles tasted", value: 0 },
      { label: "Contributions", value: 0 },
    ],
    ratings: { pass: 0, savor: 0, sip: 0 },
    totalTastings: 0,
  },
};
