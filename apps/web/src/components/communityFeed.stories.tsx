import {
  mockActivity,
  mockExternalReview,
  mockTastings,
} from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PortraitBottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/exclusive-malts-islay-2007.jpg";
import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import {
  getCommunityFeedItems,
  getTastingFeedItems,
} from "../lib/communityFeed";
import { CommunityFeed, type CommunityFeedItem } from "./communityFeed.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

function withStoryImages(items: readonly CommunityFeedItem[]) {
  return items.map((item, itemIndex) => ({
    ...item,
    actorImageUrl: null,
    bottles: item.bottles.map((bottle, bottleIndex) => ({
      ...bottle,
      imageUrl:
        item.kind === "collection_add"
          ? null
          : (itemIndex + bottleIndex) % 2
            ? PortraitBottleImage.src
            : BottleImage.src,
    })),
  }));
}

const meta = {
  title: "Components/Reviews & Tastings/Community Feed",
  component: CommunityFeed,
  parameters: {
    docs: {
      description: {
        component:
          "Shared by activity and full-width tasting lists on the homepage, activity, bottle, brand or producer, and member pages. Map activity with getCommunityFeedItems and tasting lists with getTastingFeedItems. Each card includes the author and links to the activity. Bottle titles still link to their bottles. Tastings and reviews use the standard three-line bottle identity; library additions use compact, single-line bottle rows. Critic bylines are optional; library status is omitted.",
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
  args: {
    items: withStoryImages(
      getCommunityFeedItems({
        activity: mockActivity,
        criticReviews: [mockExternalReview],
      }),
    ),
  },
} satisfies Meta<typeof CommunityFeed>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
export const TastingList: Story = {
  args: {
    ariaLabel: "Tastings",
    items: withStoryImages(getTastingFeedItems(mockTastings.slice(0, 3))),
  },
};
export const NarrowColumn: Story = {
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
        story:
          "A narrow desktop column, such as a sidebar, keeps the usual activity image size even when the screen itself is wide.",
      },
    },
  },
};
export const WithoutCriticByline: Story = {
  args: {
    items: withStoryImages(
      getCommunityFeedItems({
        activity: [],
        criticReviews: [{ ...mockExternalReview, reviewerName: null }],
      }),
    ),
  },
};
