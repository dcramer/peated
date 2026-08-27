import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { HomeCriticReviews } from "./homeDiscovery.stylex";

const criticMeta = {
  title: "Patterns/Home/Critic Reviews",
  component: HomeCriticReviews,
  args: {
    reviews: [
      {
        bottleHref: "#port-ellen",
        bottleName: "Port Ellen Prism",
        date: "2 days ago",
        metadata: ["46 years", "57.8% ABV", "1978 vintage"],
        score: 94,
        source: "Whisky Advocate",
        sourceHref: "#whisky-advocate",
        summary:
          "Forty-six years in and the smoke has turned to embers—extraordinary, and priced accordingly.",
      },
      {
        bottleHref: "#kilchoman",
        bottleName: "Kilchoman Loch Gorm 2026",
        date: "4 days ago",
        metadata: ["10 years", "46.0% ABV", "Oloroso"],
        score: 88,
        source: "Whiskyfun",
        sourceHref: "#whiskyfun",
        summary:
          "Sherry and soot in equal measure. The most confident Loch Gorm yet.",
      },
    ],
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof HomeCriticReviews>;

export default criticMeta;
type Story = StoryObj<typeof criticMeta>;

export const RecentReviews: Story = {};

export const WithoutSummaries: Story = {
  args: {
    reviews: criticMeta.args.reviews.map((review) => ({
      ...review,
      summary: undefined,
    })),
  },
};
