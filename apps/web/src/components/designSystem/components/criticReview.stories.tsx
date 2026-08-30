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
    rating: 92,
    reviewerName: "Jonny McCormick",
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

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <CriticReview {...args} />
      <CriticReview
        publication="Malt Review"
        publishedAt="2 Sep 2024"
        rating={80}
      />
      <CriticReview publication="Whisky Notes" rating={null} />
    </StoryStack>
  ),
};
