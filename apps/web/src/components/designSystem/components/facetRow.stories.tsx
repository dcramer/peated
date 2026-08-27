import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { FacetRow, type FacetRowProps } from "./facetRow.stylex";

const meta = {
  title: "Components/Selection/Facet Row",
  component: FacetRow,
  args: {
    count: 12,
    label: "Islay",
    onClick: () => undefined,
    selected: false,
    total: 41,
  },
  argTypes: {
    onClick: { table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<FacetRowProps>;

export default meta;
type Story = StoryObj<FacetRowProps>;

export const Available: Story = {};

export const Selected: Story = {
  args: { selected: true },
};

export const LongLabel: Story = {
  args: { count: 6, label: "Campbeltown and the Islands", total: 41 },
};

export const WithoutCount: Story = {
  args: { count: undefined, label: "Single malt", total: undefined },
};

export const Unavailable: Story = {
  args: { count: null, label: "Paid under £100" },
};
