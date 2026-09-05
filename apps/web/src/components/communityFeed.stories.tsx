import {
  mockActivity,
  mockExternalReview,
  mockTastings,
} from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import OblongTastingPhoto from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/exclusive-malts-islay-2007.jpg";
import SquareTastingPhoto from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/compass-box-spice-tree-extravaganza.webp";
import {
  getCommunityFeedItems,
  getTastingFeedItems,
} from "../lib/communityFeed";
import { CommunityFeed, type CommunityFeedItem } from "./communityFeed.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const tastingPhotos = [
  SquareTastingPhoto.src,
  OblongTastingPhoto.src,
  null,
] as const;

function withStoryImages(
  items: readonly CommunityFeedItem[],
): CommunityFeedItem[] {
  return items.map((item, itemIndex) => {
    const tastingPhoto = tastingPhotos[itemIndex % tastingPhotos.length];
    return {
      ...item,
      actorImageUrl: null,
      bottles: item.bottles.map((bottle) => ({
        ...bottle,
        imageFit: item.kind === "tasting" && tastingPhoto ? "cover" : "contain",
        imageUrl:
          item.kind === "collection_add"
            ? null
            : item.kind === "tasting"
              ? tastingPhoto
              : SquareTastingPhoto.src,
      })),
    };
  });
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
  parameters: {
    docs: {
      description: {
        story:
          "Covers a square tasting photo and an oblong tasting photo, then shows the framed missing-image state.",
      },
    },
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
