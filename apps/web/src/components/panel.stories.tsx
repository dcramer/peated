import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Panel } from "./panel.stylex";
import { RailLinkList, RecordSection } from "./recordDetails.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Layout/Panel",
  component: Panel,
  args: { children: null, title: "Recent changes" },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <RecordSection title="Record activity">
        <RailLinkList
          ariaLabel="Record activity"
          items={[
            { href: "#one", metadata: "Today", name: "Bottle added" },
            { href: "#two", metadata: "Yesterday", name: "Review published" },
          ]}
        />
      </RecordSection>
      <Panel aside="14" asideFormat="data" title="Recent changes">
        <RailLinkList
          ariaLabel="Recent changes"
          items={[
            {
              href: "#three",
              metadata: "2 minutes ago",
              name: "Bottle photo updated",
            },
            {
              href: "#four",
              metadata: "Yesterday",
              name: "Strength corrected",
            },
            {
              href: "#five",
              metadata: "4 days ago",
              name: "Release linked",
            },
          ]}
        />
      </Panel>
    </StoryStack>
  ),
};
