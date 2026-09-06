import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StoryCanvas } from "../storyFixtures.stylex";
import ScraperActivity from "./scraperActivity";

const emptyCounts = {
  requests: 0,
  requestErrors: 0,
  requestErrorsComplete: true,
  runs: 0,
  failedRuns: 0,
  records: 0,
  newRecords: 0,
  existingRecords: 0,
  untrackedRecords: 0,
};

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
          "The admin overview shows 30 days of collection requests, runs, saved records, and recent scraper problems. Preview and suggestion runs are excluded.",
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
        records: 92,
        newRecords: 31,
        existingRecords: 55,
        untrackedRecords: 6,
      },
      days: [
        {
          date: "2026-09-05",
          requests: 42,
          requestErrors: 2,
          requestErrorsComplete: true,
          runs: 4,
          failedRuns: 1,
          records: 28,
          newRecords: 9,
          existingRecords: 19,
          untrackedRecords: 0,
        },
        {
          date: "2026-09-04",
          requests: 31,
          requestErrors: 0,
          requestErrorsComplete: false,
          runs: 3,
          failedRuns: 0,
          records: 20,
          newRecords: 4,
          existingRecords: 10,
          untrackedRecords: 6,
        },
      ],
      recordTypes: [
        {
          type: "review",
          records: 47,
          newRecords: 18,
          existingRecords: 29,
          untrackedRecords: 0,
        },
        {
          type: "price",
          records: 39,
          newRecords: 13,
          existingRecords: 26,
          untrackedRecords: 0,
        },
        {
          type: "untracked",
          records: 6,
          newRecords: 0,
          existingRecords: 0,
          untrackedRecords: 6,
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
      totals: emptyCounts,
      days: [
        { date: "2026-09-05", ...emptyCounts },
        { date: "2026-09-04", ...emptyCounts },
      ],
      recordTypes: [],
      recentFailures: [],
    },
  },
};
