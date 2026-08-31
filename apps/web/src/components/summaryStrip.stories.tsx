import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";
import { SummaryStrip } from "./summaryStrip.stylex";

const meta = {
  title: "Components/Lists & Tables/Summary Strip",
  component: SummaryStrip,
  args: {
    cells: [
      { label: "Tastings", value: 128 },
      { label: "Distillers", value: 63 },
      { label: "Never poured", value: 6 },
      {
        detail: "15 · 44 · 69",
        label: "Community ratings",
        value: 128,
      },
    ],
  },
  argTypes: { cells: { control: "object" } },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof SummaryStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <SummaryStrip {...args} />
      <SummaryStrip
        cells={[
          { label: "Bottlings", value: "2,841" },
          { label: "Distillers", value: 148 },
          { label: "Countries", value: 12 },
        ]}
      />
      <SummaryStrip
        cells={[
          { label: "Bottlings", value: 41 },
          { label: "Tastings", value: 128 },
          { label: "Distillers", value: 23 },
          { label: "Regions", value: 5 },
          { label: "Never poured", value: 6 },
        ]}
      />
    </StoryStack>
  ),
};
