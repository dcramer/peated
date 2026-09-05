import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  DistributionList,
  DistributionListLoading,
} from "./distributionList.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Lists & Tables/Distribution List",
  component: DistributionList,
  args: {
    items: [
      { count: 842, label: "Single malt" },
      { count: 311, label: "Blend" },
      { count: 126, label: "Single grain" },
      { count: 0, label: "Unknown" },
    ],
  },
  argTypes: { items: { control: "object" } },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof DistributionList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const Loading: Story = {
  render: () => <DistributionListLoading />,
};
