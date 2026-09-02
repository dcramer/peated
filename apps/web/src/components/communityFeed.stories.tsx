import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { CommunityFeed } from "./communityFeed.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Reviews & Tastings/Community Feed",
  component: CommunityFeed,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof CommunityFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {
  args: {
    items: [
      {
        date: "2026-08-28T12:00:00.000Z",
        description: "Smoke, dried fruit, sea salt, and a long finish.",
        href: "/tastings/42",
        id: "tasting-42",
        imageUrl: BottleImage.src,
        label: "stillroom · Member tasting",
        metadata: "Single malt · 16 years · 43% ABV",
        rating: "Outstanding",
        title: "Lagavulin 16-year-old",
      },
      {
        date: "2026-08-27T12:00:00.000Z",
        description: "Revisiting Lagavulin 16-year-old",
        href: "https://example.com/reviews/lagavulin-16",
        id: "critic-91",
        label: "Words of Whisky · Critic review",
        metadata: "Single malt · 16 years · 43% ABV",
        rating: "90",
        title: "Lagavulin 16-year-old",
      },
    ],
  },
};
