import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { RatingSummary } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Ratings/Rating Summary",
  component: RatingSummary,
  args: {
    ariaLabel: "Bottle rating",
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
          "Use once in a catalog header or sidebar. The large value comes first, with its rating name underneath. With tastings only, it shows the middle tasting's full range instead of an exact score. Keep detailed rating breakdowns with the reviews and tastings.",
      },
    },
  },
} satisfies Meta<typeof RatingSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <RatingSummary {...args} />
      <RatingSummary
        ariaLabel="Bottle rating"
        externalScoreCount={2}
        median={86}
      />
      <RatingSummary
        ariaLabel="Bottle rating"
        tastingCounts={{ outstanding: 2, unicorn: 1, very_good: 4 }}
      />
      <RatingSummary ariaLabel="Bottle rating" />
    </StoryStack>
  ),
};
