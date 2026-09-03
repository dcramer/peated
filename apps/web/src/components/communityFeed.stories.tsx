import {
  mockActivity,
  mockExternalReview,
} from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getCommunityFeedItems } from "../lib/communityFeed";
import { CommunityFeed } from "./communityFeed.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Reviews & Tastings/Community Feed",
  component: CommunityFeed,
  parameters: {
    docs: {
      description: {
        component:
          "Shared by the homepage, global activity, and member profiles. Map API entries with getCommunityFeedItems. Tastings, critic reviews, member reviews, and library additions share an author header. Tastings and reviews use the standard three-line bottle identity; library additions use compact, single-line bottle rows. Critic bylines are optional; library status is omitted.",
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
export const WithoutCriticByline: Story = {
  args: {
    items: getCommunityFeedItems({
      activity: [],
      criticReviews: [{ ...mockExternalReview, reviewerName: null }],
    }),
  },
};
