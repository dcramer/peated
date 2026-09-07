import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "./storyFixtures.stylex";
import { Timestamp } from "./timestamp";

const meta = {
  title: "Components/Content/Timestamp",
  component: Timestamp,
  args: {
    date: "2026-09-06T04:30:00.000Z",
    format: "dateTime",
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Shows a saved moment in the viewer's timezone. Initial page output uses UTC, then the browser replaces it with local time.",
      },
    },
  },
} satisfies Meta<typeof Timestamp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
