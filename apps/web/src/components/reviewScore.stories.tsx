import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button.stylex";
import { ReviewScore } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Ratings/Review Score",
  component: ReviewScore,
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
} satisfies Meta<typeof ReviewScore>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ReviewScore {...args} />
      <ReviewScore count={1} high={89} low={89} median={89} />
      <ReviewScore
        contributionAction={
          <Button size="sm" variant="text">
            Write a review
          </Button>
        }
        count={0}
      />
    </StoryStack>
  ),
};
