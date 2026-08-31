import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FacetRow, type FacetRowProps } from "./facetRow.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Search/Facet Row",
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

export const Overview: Story = {
  render: (args: FacetRowProps) => (
    <StoryStack>
      <FacetRow count={12} label="Islay" onClick={args.onClick} total={41} />
      <FacetRow
        count={12}
        label="Speyside"
        onClick={args.onClick}
        selected
        total={41}
      />
      <FacetRow
        count={6}
        label="Campbeltown and the Islands"
        onClick={args.onClick}
        total={41}
      />
      <FacetRow
        count={undefined}
        label="Single malt"
        onClick={args.onClick}
        total={undefined}
      />
      <FacetRow count={null} label="Paid under £100" onClick={args.onClick} />
    </StoryStack>
  ),
};
