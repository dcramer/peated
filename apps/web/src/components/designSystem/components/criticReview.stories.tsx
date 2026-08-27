import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { CriticReview } from "./criticReview.stylex";

const meta = {
  title: "Components/Data Display/Critic Review",
  component: CriticReview,
  args: {
    href: "#review",
    publication: "Whisky Advocate",
    publishedAt: "14 Mar 2025",
    reviewerName: "Jonny McCormick",
    score: { display: "92/100", scale: 100, value: 92 },
    summary:
      "Dense smoke, preserved citrus, and a maritime finish with excellent balance.",
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof CriticReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NativeScales: Story = {
  render: () => (
    <StoryStack>
      <CriticReview
        publication="Whisky Advocate"
        publishedAt="14 Mar 2025"
        reviewerName="Jonny McCormick"
        score={{ display: "92/100", scale: 100, value: 92 }}
      />
      <CriticReview
        publication="Malt Review"
        publishedAt="2 Sep 2024"
        score={{ display: "8/10", scale: 10, value: 8 }}
      />
      <CriticReview
        publication="Dramface"
        score={{ display: "4.5/5", scale: 5, value: 4.5 }}
      />
    </StoryStack>
  ),
};

export const Unscored: Story = {
  args: {
    score: null,
    summary:
      "The publication did not assign a score. The review remains useful and attributed.",
  },
};
