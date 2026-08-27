import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { CommunityScore } from "./scoring.stylex";

const meta = {
  title: "Components/Data Display/Community Score",
  component: CommunityScore,
  args: { count: 128, score: 88.4 },
  argTypes: {
    count: { control: { min: 1, step: 1, type: "number" } },
    score: { control: { max: 100, min: 0, step: 0.1, type: "number" } },
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof CommunityScore>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Aggregate: Story = {};

export const OneScore: Story = { args: { count: 1, score: 91 } };
