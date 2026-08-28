import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { Button } from "./button.stylex";
import { Score } from "./scoring.stylex";

const meta = {
  title: "Components/Measures/Score",
  component: Score,
  args: {
    count: 128,
    high: 96,
    low: 76,
    median: 89,
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof Score>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <Score {...args} />
      <Score
        contributionAction={
          <Button size="sm" variant="text">
            Write a review
          </Button>
        }
        count={12}
        high={94}
        low={79}
        median={89}
      />
      <Score count={0} />
    </StoryStack>
  ),
};
