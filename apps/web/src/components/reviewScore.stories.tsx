import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ReviewScore } from "./scoring.stylex";
import { StoryRow, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Ratings/Review Score",
  component: ReviewScore,
  args: { score: 92 },
} satisfies Meta<typeof ReviewScore>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <StoryRow>
        <ReviewScore score={92} />
        <ReviewScore scale={10} score={8} />
      </StoryRow>
      <StoryRow>
        <ReviewScore score={92} size="lg" />
      </StoryRow>
    </StoryStack>
  ),
};
