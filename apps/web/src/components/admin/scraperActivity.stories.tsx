import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StoryCanvas } from "../storyFixtures.stylex";
import ScraperActivity from "./scraperActivity.stylex";

const emptyHealth = {
  requests: 0,
  requestErrors: 0,
  requestErrorsComplete: true,
  runs: 0,
  failedRuns: 0,
};

const emptySaved = { total: 0, new: 0, existing: 0 };

const meta = {
  title: "Admin/Scraper Activity",
  component: ScraperActivity,
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
          "Shows 30-day scraper output, request health, daily details, and recent problems.",
      },
    },
  },
  args: {
    data: {
      totals: {
        requests: 184,
        requestErrors: 7,
        requestErrorsComplete: false,
        runs: 16,
        failedRuns: 2,
      },
      saved: {
        reviews: { total: 47, new: 18, existing: 29 },
        prices: { total: 42, new: 13, existing: 26 },
        catalogListings: { total: 21, new: 6, existing: 15 },
      },
      bottleResolution: {
        unknown: 8,
        created: 6,
        matched: 75,
      },
      days: [
        {
          date: "2026-09-05",
          requests: 42,
          requestErrors: 2,
          requestErrorsComplete: true,
          runs: 4,
          failedRuns: 1,
          reviews: 12,
          prices: 9,
          catalogListings: 4,
        },
        {
          date: "2026-09-04",
          requests: 31,
          requestErrors: 0,
          requestErrorsComplete: false,
          runs: 3,
          failedRuns: 0,
          reviews: 8,
          prices: 11,
          catalogListings: 3,
        },
        {
          date: "2026-09-03",
          requests: 27,
          requestErrors: 0,
          requestErrorsComplete: true,
          runs: 2,
          failedRuns: 0,
          reviews: 6,
          prices: 7,
          catalogListings: 2,
        },
      ],
      recentFailures: [
        {
          runId: 42,
          site: { key: "example", name: "Example source" },
          error: "The source was temporarily unavailable.",
          completedAt: "2026-09-05T18:30:00.000Z",
        },
      ],
    },
  },
} satisfies Meta<typeof ScraperActivity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const NoActivity: Story = {
  args: {
    data: {
      totals: emptyHealth,
      saved: {
        reviews: emptySaved,
        prices: emptySaved,
        catalogListings: emptySaved,
      },
      bottleResolution: { unknown: 0, created: 0, matched: 0 },
      days: [
        {
          date: "2026-09-05",
          ...emptyHealth,
          reviews: 0,
          prices: 0,
          catalogListings: 0,
        },
      ],
      recentFailures: [],
    },
  },
};
