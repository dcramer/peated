import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { HistoryTimeline } from "./historyTimeline.stylex";
import { SectionHeading } from "./sectionHeading.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const broraHistory = [
  {
    date: "1819",
    description:
      "Founded as Clynelish by the Marquis of Stafford to serve the surrounding estate.",
    state: "operating",
    title: "Distillery founded",
  },
  {
    date: "1969",
    description:
      "The original distillery reopened under the Brora name after the new Clynelish stillhouse began production.",
    source: { href: "https://www.diageo.com/", label: "Diageo archive" },
    state: "operating",
    title: "Renamed Brora",
  },
  {
    date: "1983",
    description: "Production stopped and the distillery was closed.",
    state: "silent",
    title: "Distillery closed",
  },
  {
    date: "2017",
    description:
      "Plans were announced to restore the distillery and its stills.",
    note: "after 34 years silent",
    state: "silent",
    title: "Restoration announced",
  },
  {
    date: "2021",
    description:
      "Brora returned to production after a careful restoration of the original buildings and equipment.",
    state: "operating",
    title: "Production resumed",
  },
] as const;

const meta = {
  title: "Components/Data Display/History Timeline",
  component: HistoryTimeline,
  decorators: [
    (Story, context) => (
      <StoryCanvas width="wide">
        <StoryStack>
          <SectionHeading count={context.args.events.length}>
            History
          </SectionHeading>
          <Story />
        </StoryStack>
      </StoryCanvas>
    ),
  ],
  args: {
    events: broraHistory,
    summary:
      "silent 1983–2021 · in production since 2021 · 5 recorded items, oldest first",
  },
} satisfies Meta<typeof HistoryTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DistilleryHistory: Story = {};

export const ContinuouslyOperating: Story = {
  args: {
    events: [
      {
        date: "1881",
        description: "The distillery was established on Islay.",
        state: "operating",
        title: "Distillery founded",
      },
      {
        date: "1994",
        description:
          "The distillery changed ownership and continued production.",
        state: "operating",
        title: "New ownership",
      },
      {
        date: "2018",
        description: "A new stillhouse expanded production capacity.",
        state: "operating",
        title: "Stillhouse expanded",
      },
    ],
    summary: "in continuous production · 3 recorded items, oldest first",
  },
};
