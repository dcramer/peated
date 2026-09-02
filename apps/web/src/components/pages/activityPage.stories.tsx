import {
  mockExternalReview,
  mockTasting,
} from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { getCommunityFeedItems } from "../../lib/communityFeed";
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
          "Activity uses the catalog columns, with Following/Everyone beside the page title. The sidebar has the contribution action and rating guidance, and is hidden on mobile. A short notice explains when Following shows everyone's activity because there are no accepted follows.",
      },
    },
  },
  args: {
    items: getCommunityFeedItems({
      criticReviews: [mockExternalReview],
      memberTastings: [mockTasting],
    }),
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
