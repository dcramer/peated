import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { HomeRecentReviews } from "./homeBrowse.stylex";

const meta = {
  title: "Patterns/Home Browse",
  component: HomeRecentReviews,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof HomeRecentReviews>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecentReviews: Story = {
  args: {
    reviews: [
      {
        bottleHref: "/bottles/47529",
        bottleName: "Milroy's of Soho Tun 89 Teaspooned Malt",
        date: "2 days ago",
        id: "47529",
        metadata: ["36 years", "52.4% ABV", "1989 vintage", "2026 release"],
        rating: 88,
        source: "Whiskyfun",
        sourceHref: "#review",
      },
      {
        bottleHref: "/bottles/47530",
        bottleName: "Thompson Bros. Enviable Blended Malt Scotch Whisky",
        date: "2 days ago",
        id: "47530",
        metadata: ["36 years", "46.5% ABV", "1989 vintage", "2026 release"],
        rating: 91,
        source: "Whiskyfun",
        sourceHref: "#review",
      },
    ],
  },
};
