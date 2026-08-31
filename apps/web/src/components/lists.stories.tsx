import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import {
  CursorPager,
  ListToolbar,
  RailList,
  RailListItem,
} from "./lists.stylex";
import { TastingRating } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const sortOptions = [
  { label: "Recently tasted", value: "recent" },
  { label: "Score", value: "score" },
  { label: "Name", value: "name" },
] as const;

function ToolbarExample() {
  const [sort, setSort] = useState("recent");

  return (
    <ListToolbar
      count={12}
      noun="bottle"
      onExport={() => undefined}
      onSortChange={setSort}
      sort={sort}
      sortOptions={sortOptions}
      total={41}
    />
  );
}

const meta = {
  title: "Components/Lists & Tables/Lists",
  component: RailList,
  args: { ariaLabel: "Records", children: null },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof RailList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <ToolbarExample />
      <RailList ariaLabel="Recent tastings">
        <RailListItem
          end={<TastingRating band="outstanding" />}
          href="/tastings/1"
          metadata="Aug 22 · 46% ABV"
          title="Port Charlotte 10 Year Old"
        />
        <RailListItem
          end="–"
          metadata="No score recorded"
          title="Unknown bottle"
        />
      </RailList>
      <CursorPager nextHref="#page-4" page={3} previousHref="#page-2" />
      <CursorPager
        ariaLabel="Cursor-only record pages"
        nextHref="#next-cursor"
        previousHref="#previous-cursor"
      />
    </StoryStack>
  ),
};
