import {
  mockActivity,
  mockExternalReview,
  mockTastings,
} from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  getCommunityFeedItems,
  getTastingFeedItems,
} from "../lib/communityFeed";
import { CommunityFeed } from "./communityFeed.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

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
    items: getCommunityFeedItems({
      activity: mockActivity,
      criticReviews: [mockExternalReview],
    }),
  },
} satisfies Meta<typeof CommunityFeed>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
export const TastingList: Story = {
  args: {
    ariaLabel: "Tastings",
    items: getTastingFeedItems(mockTastings.slice(0, 3)),
  },
};
export const WithoutCriticByline: Story = {
  args: {
    items: getCommunityFeedItems({
      activity: [],
      criticReviews: [{ ...mockExternalReview, reviewerName: null }],
    }),
  },
};
