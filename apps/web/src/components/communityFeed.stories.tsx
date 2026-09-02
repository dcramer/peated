import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { CommunityFeed } from "./communityFeed.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Reviews & Tastings/Community Feed",
  component: CommunityFeed,
  parameters: {
    docs: {
      description: {
        component:
          "A mixed feed with reviews as the primary destination and separate bottle links. Review scores and tasting ratings are centered beside the bottle name, author, and details; italic previews sit below that header.",
      },
    },
  },
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

export const Overview: Story = {
  args: {
    items: [
      {
        actor: "stillroom",
        actorHref: "/users/stillroom",
        bottleHref: "/bottles/7-lagavulin-16-year-old",
        date: "2026-08-28T12:00:00.000Z",
        description: "Smoke, dried fruit, sea salt, and a long finish.",
        href: "/tastings/42",
        id: "tasting-42",
        imageUrl: BottleImage.src,
        metadata: "Single malt · 16 years · 43% ABV",
        ratingBand: "outstanding",
        title: "Lagavulin 16-year-old",
      },
      {
        actor: "Words of Whisky",
        actorHref: "https://example.com/reviews/lagavulin-16",
        bottleHref: "/bottles/7-lagavulin-16-year-old",
        date: "2026-08-27T12:00:00.000Z",
        description: "Revisiting Lagavulin 16-year-old",
        href: "https://example.com/reviews/lagavulin-16",
        id: "critic-91",
        metadata: "Single malt · 16 years · 43% ABV",
        score: 90,
        title: "Lagavulin 16-year-old",
      },
    ],
  },
};
