import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import OperationsOverview from "./operationsOverview.stylex";

const meta = {
  title: "Admin/Operations Overview",
  component: OperationsOverview,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Summarizes live background work and recent price matching on the admin overview.",
      },
    },
  },
  args: {
    bottleResolution: {
      unknown: 8,
      created: 6,
      matched: 75,
    },
    data: {
      generatedAt: "2026-09-06T18:00:00.000Z",
      counts: {
        processing: 4,
        waiting: 12,
        failed: 2,
        clearedToday: 86,
      },
      listingAutomation: {
        sampleSize: 100,
        automatic: 73,
        manual: 24,
        failed: 3,
        rate: 73,
        byProposalType: [
          {
            proposalType: "match_existing",
            sampleSize: 72,
            automatic: 65,
            manual: 6,
            failed: 1,
            rate: 90,
          },
          {
            proposalType: "create_new",
            sampleSize: 28,
            automatic: 8,
            manual: 18,
            failed: 2,
            rate: 29,
          },
        ],
      },
      needsAttention: [],
      recentRuns: [],
    },
  },
} satisfies Meta<typeof OperationsOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const Quiet: Story = {
  args: {
    bottleResolution: {
      unknown: 0,
      created: 0,
      matched: 0,
    },
    data: {
      generatedAt: "2026-09-06T18:00:00.000Z",
      counts: {
        processing: 0,
        waiting: 0,
        failed: 0,
        clearedToday: 0,
      },
      listingAutomation: {
        sampleSize: 0,
        automatic: 0,
        manual: 0,
        failed: 0,
        rate: null,
        byProposalType: [],
      },
      needsAttention: [],
      recentRuns: [],
    },
  },
};
