import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../../components/storyFixtures.stylex";
import { broraAbout } from "./articles/brora";
import { EntityLifeline } from "./entityLifeline.stylex";

const meta = {
  title: "Components/History/Lifeline",
  component: EntityLifeline,
  args: {
    currentYear: 2026,
    lanes: [
      { label: "Status", spans: broraAbout.operating, quietLabel: "Silent" },
      { label: "Name", spans: broraAbout.names, tone: "neutral" },
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
