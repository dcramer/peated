import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import {
  CursorPager,
  ListToolbar,
  PeriodHeader,
  RailList,
  RailListItem,
} from "./listStructures.stylex";
import { VerdictMark } from "./scoring.stylex";

const sortOptions = [
  { label: "Recently tasted", value: "recent" },
  { label: "Community score", value: "score" },
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
  title: "Components/Data Display/Lists",
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

export const BottleListControls: Story = {
  render: () => <ToolbarExample />,
};

export const PreviousAndNext: Story = {
  render: () => (
    <CursorPager nextHref="#page-4" page={3} previousHref="#page-2" />
  ),
};

export const TastingsByMonth: Story = {
  render: () => (
    <StoryStack>
      <div>
        <PeriodHeader>August 2026</PeriodHeader>
        <RailList ariaLabel="August 2026 tastings">
          <RailListItem
            end={<VerdictMark verdict="savor" />}
            href="/tastings/1"
            metadata="Aug 22 · 46% ABV"
            title="Port Charlotte 10 Year Old"
          />
          <RailListItem
            end={<VerdictMark verdict="sip" />}
            href="/tastings/2"
            metadata="Aug 14 · 54.2% ABV"
            title="Ardbeg Uigeadail"
          />
        </RailList>
      </div>
      <div>
        <PeriodHeader>July 2026</PeriodHeader>
        <RailList ariaLabel="July 2026 tastings">
          <RailListItem
            end={<VerdictMark verdict="pass" />}
            href="/tastings/3"
            metadata="Jul 30 · 43% ABV"
            title="Caol Ila 12 Year Old"
          />
        </RailList>
      </div>
    </StoryStack>
  ),
};

export const LongBottleNames: Story = {
  render: () => (
    <RailList ariaLabel="Recent tastings">
      <RailListItem
        end="91.3"
        href="/tastings/4"
        metadata="A deliberately long metadata value that stays within the fixed row slot"
        title="A deliberately long independent bottling name that truncates before the value"
      />
      <RailListItem
        end="–"
        metadata="No score recorded"
        title="Unknown bottle"
      />
    </RailList>
  ),
};
