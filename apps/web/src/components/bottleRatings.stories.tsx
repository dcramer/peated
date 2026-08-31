import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BottleRatings } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Ratings/Bottle Ratings",
  component: BottleRatings,
  args: {
    counts: {
      good: 34,
      mediocre: 12,
      outstanding: 178,
      unicorn: 92,
      very_good: 96,
    },
    high: 97,
    low: 78,
    median: 91,
    scoreCount: 84,
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof BottleRatings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <BottleRatings {...args} />
      <BottleRatings
        counts={{
          good: 8,
          mediocre: 10,
          outstanding: 9,
          unicorn: 2,
          very_good: 17,
        }}
        high={93}
        low={76}
        median={86}
        scoreCount={18}
      />
      <BottleRatings counts={{ outstanding: 2, unicorn: 1, very_good: 4 }} />
      <BottleRatings />
    </StoryStack>
  ),
};
