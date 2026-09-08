import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BottleRatings } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Ratings/Bottle Ratings",
  component: BottleRatings,
  args: {
    maxScore: 96,
    median: 91,
    minScore: 84,
    raterCount: 24,
    scoreCount: 5,
    tastingCounts: {
      good: 1,
      mediocre: 0,
      outstanding: 5,
      unicorn: 2,
      very_good: 2,
    },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Use at the end of a bottle row. It shows the rating name, distinct rater count, and middle review score. Wide rows add the exact review-score range; narrow rows omit it. With tastings only, it shows the middle tasting's full range. Bottles with no ratings show nothing.",
      },
    },
  },
} satisfies Meta<typeof BottleRatings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <BottleRatings {...args} />
      <BottleRatings
        maxScore={92}
        median={86}
        minScore={81}
        raterCount={5}
        scoreCount={5}
      />
      <BottleRatings median={90} scoreCount={1} />
      <BottleRatings
        raterCount={7}
        tastingCounts={{ outstanding: 2, unicorn: 1, very_good: 4 }}
      />
      <BottleRatings />
    </StoryStack>
  ),
};
