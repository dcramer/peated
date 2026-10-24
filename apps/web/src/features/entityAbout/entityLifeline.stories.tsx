import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { mockBrora, mockEntityAbouts } from "@peated/server/orpc/mock/fixtures";
import { StoryCanvas } from "../../components/storyFixtures.stylex";

import { getNameSpans, getOperatingSpans } from "./entityAbout";
import { EntityLifeline } from "./entityLifeline.stylex";

const broraAbout = mockEntityAbouts.get(mockBrora.id)!;

const meta = {
  title: "Components/History/Lifeline",
  component: EntityLifeline,
  args: {
    currentYear: 2026,
    lanes: [
      {
        label: "Status",
        spans: getOperatingSpans(broraAbout),
        quietLabel: "Silent",
      },
      {
        label: "Name",
        spans: getNameSpans(broraAbout, mockBrora.name),
        tone: "neutral",
      },
    ],
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof EntityLifeline>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Brora: two long silences, one rename, and narrow spans kept in tooltips. */
export const Overview: Story = {};
