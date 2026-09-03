import { ORPCError } from "@orpc/client";
import { mockBottle } from "@peated/server/orpc/mock/fixtures";
import type { ExternalReviewScoringPolicy } from "@peated/server/schemas";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StoryCanvas } from "../storyFixtures.stylex";
import { ReviewScoringForm } from "./reviewScoringForm.stylex";

// Deliberately fictional guide; story score rules are not source presets.
const policy: ExternalReviewScoringPolicy = {
  enabled: true,
  rules: [
    {
      scale: 10,
      guideUrl: "https://example.com/scoring",
      explanation: "Example guide: scores are tenths of a 100-point score.",
      from: null,
      until: null,
      points: [
        { source: 0, target: 0 },
        { source: 10, target: 100 },
      ],
    },
  ],
};

const meta = {
  title: "Admin/Review Score Setup",
  component: ReviewScoringForm,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    settings: { version: 1, policy, recomputePending: false },
    onPreview: async (next) => ({
      version: 1,
      totalBottles: 1,
      samples: [
        {
          id: 1,
          name: "Example review",
          url: "https://example.com/review",
          nativeScore: { value: 8.7, scale: 10, display: "8.7/10" },
          before: { value: 87, reason: "counted", guideUrl: null },
          after: {
            value: next.enabled ? 87 : null,
            reason: next.enabled ? "counted" : "excluded",
            guideUrl: null,
          },
          contribution: {
            value: next.enabled ? 87 : null,
            reason: next.enabled ? "counted" : "excluded",
            guideUrl: null,
          },
        },
      ],
      bottles: [
        {
          bottle: mockBottle,
          before: { median: 87, count: 2 },
          after: {
            median: next.enabled ? 87 : 91,
            count: next.enabled ? 2 : 1,
          },
        },
      ],
    }),
    onSave: async () => {},
  },
} satisfies Meta<typeof ReviewScoringForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
export const Unreviewed: Story = {
  args: { settings: { version: 0, policy: null, recomputePending: false } },
};
export const PendingRefresh: Story = {
  args: { settings: { version: 1, policy, recomputePending: true } },
};
export const SaveConflict: Story = {
  args: {
    onSave: async () => {
      throw new ORPCError("CONFLICT", {
        defined: true,
        message: "Scoring settings changed. Preview your changes again.",
      });
    },
  },
};
