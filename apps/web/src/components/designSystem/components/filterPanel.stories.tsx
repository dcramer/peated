import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { FacetRow } from "./facetRow.stylex";
import { FilterPanel, type FilterPanelProps } from "./filterPanel.stylex";

const meta = {
  title: "Components/Selection/Filter Panel",
  component: FilterPanel,
  args: {
    ariaLabel: "Bottle filters",
    children: null,
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<FilterPanelProps>;

export default meta;
type Story = StoryObj<FilterPanelProps>;

export const Overview: Story = {
  render: (args) => (
    <FilterPanel ariaLabel={args.ariaLabel}>
      <StoryStack>
        <FacetRow label="Scotland" onClick={() => undefined} selected />
        <FacetRow label="Japan" onClick={() => undefined} />
        <FacetRow label="United States" onClick={() => undefined} />
      </StoryStack>
    </FilterPanel>
  ),
};
