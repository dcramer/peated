import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BottleRatingSummary } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Ratings/Bottle Rating Summary",
  component: BottleRatingSummary,
  args: {
    externalScoreCount: 2,
    memberScoreCount: 3,
    median: 91,
    tastingCounts: { good: 1, outstanding: 5, unicorn: 2, very_good: 2 },
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
          "Use once in a bottle header. The large value comes first, with its rating name underneath. With tastings only, it shows the middle tasting's full range instead of an exact score. Keep detailed rating breakdowns with the reviews and tastings.",
      },
    },
  },
} satisfies Meta<typeof BottleRatingSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <BottleRatingSummary {...args} />
      <BottleRatingSummary externalScoreCount={2} median={86} />
      <BottleRatingSummary
        tastingCounts={{ outstanding: 2, unicorn: 1, very_good: 4 }}
      />
      <BottleRatingSummary />
    </StoryStack>
  ),
};
