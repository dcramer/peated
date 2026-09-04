import {
  mockActivity,
  mockCollectionBottles,
  mockExternalReview,
} from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { toBottleListItem } from "../../lib/bottleListItem";

import { getCommunityFeedItems } from "../../lib/communityFeed";
import { CursorPager } from "../lists.stylex";
import { PageTabs } from "../pageTabs.stylex";
import { StoryCanvas } from "../storyFixtures.stylex";
import { ActivityPage } from "./activityPage.stylex";

const meta = {
  title: "Pages/Activity",
  component: ActivityPage,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Activity uses the catalog columns, with Following/Everyone beside the page title and aligned with the feed column. The cursor pager keeps the selected feed while moving through activity. The sidebar has the tasting action and bottles from the member’s library, and is hidden on mobile. A short notice explains when Following shows everyone's activity because there are no accepted follows.",
      },
    },
  },
  args: {
    items: getCommunityFeedItems({
      criticReviews: [],
      activity: [
        {
          id: `critic_review:${mockExternalReview.id}`,
          type: "critic_review",
          priority: "primary",
          createdAt: mockExternalReview.article.publishedAt!,
          review: mockExternalReview,
        },
        ...mockActivity,
      ],
    }),
    libraryBottles: mockCollectionBottles
      .filter((item) => !item.hasTasted)
      .slice(0, 3)
      .map((item) => toBottleListItem(item.bottle)),
    libraryHref: "/users/mock-user/library",
    pagination: (
      <CursorPager
        ariaLabel="Activity pages"
        nextHref="/activity?feed=everyone&cursor=2%3A1780833600000&page=2"
        page={1}
      />
    ),
    selector: (
      <PageTabs
        ariaLabel="Activity feeds"
        currentHref="/activity?feed=everyone"
        items={[
          { href: "/activity?feed=following", label: "Following" },
          { href: "/activity?feed=everyone", label: "Everyone" },
        ]}
      />
    ),
  },
} satisfies Meta<typeof ActivityPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const NoFollows: Story = {
  args: {
    note: "You're not following anyone yet. Showing everyone's activity.",
    pagination: (
      <CursorPager
        ariaLabel="Activity pages"
        nextHref="/activity?feed=following&cursor=2%3A1780833600000&page=2"
        page={1}
      />
    ),
    selector: (
      <PageTabs
        ariaLabel="Activity feeds"
        currentHref="/activity?feed=following"
        items={[
          { href: "/activity?feed=following", label: "Following" },
          { href: "/activity?feed=everyone", label: "Everyone" },
        ]}
      />
    ),
  },
};
