import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import {
  CursorPager,
  ListToolbar,
  RailList,
  RailListItem,
} from "./lists.stylex";
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
  args: { ariaLabel: "Reviews", children: null },
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
      <RailList ariaLabel="Recent reviews">
        <RailListItem
          end="88/100"
          href="/reviews/1"
          metadata="Member · Aug 22, 2026"
          title="j.macleod"
        />
        <RailListItem
          href="https://example.com/review"
          metadata="Aug 20, 2026"
          title="Whiskyfun"
        />
      </RailList>
      <CursorPager nextHref="#page-4" page={3} previousHref="#page-2" />
      <CursorPager
        ariaLabel="Bottle pages"
        nextHref="#next-cursor"
        previousHref="#previous-cursor"
      />
    </StoryStack>
  ),
};

export const UpdatingResults: Story = {
  render: () => (
    <ListToolbar
      count={12}
      noun="bottle"
      onSortChange={() => undefined}
      pending
      sort="name"
      sortOptions={sortOptions}
      total={41}
    />
  ),
};
