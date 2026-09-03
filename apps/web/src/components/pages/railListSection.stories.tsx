"use client";

import { mockBottles } from "@peated/server/orpc/mock/fixtures";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { RailList, RailListItem } from "..";
import { StoryCanvas } from "../storyFixtures.stylex";
import { BottleRailSection } from "./bottleRailSection.stylex";
import { RailListSection } from "./railListSection.stylex";

const distilleries = [
  { bottles: 9, name: "Bruichladdich" },
  { bottles: 9, name: "Port Charlotte" },
  { bottles: 8, name: "Octomore" },
  { bottles: 2, name: "Bowmore" },
  { bottles: 1, name: "Bunnahabhain" },
  { bottles: 1, name: "Caol Ila" },
  { bottles: 1, name: "Springbank" },
] as const;

function ExpandableDistilleries() {
  const [expanded, setExpanded] = useState(false);
  const visibleDistilleries = expanded
    ? distilleries
    : distilleries.slice(0, 5);

  return (
    <RailListSection
      action={{
        ariaControls: "story-distilleries",
        expanded,
        label: expanded
          ? "Show fewer distilleries"
          : `View all ${distilleries.length} distilleries`,
        onClick: () => setExpanded((value) => !value),
      }}
      heading="Distilleries"
    >
      <div id="story-distilleries">
        <RailList ariaLabel="Series distilleries">
          {visibleDistilleries.map((distillery) => (
            <RailListItem
              end={`${distillery.bottles} ${
                distillery.bottles === 1 ? "bottle" : "bottles"
              }`}
              href={`#${distillery.name.toLowerCase().replaceAll(" ", "-")}`}
              key={distillery.name}
              title={distillery.name}
            />
          ))}
        </RailList>
      </div>
    </RailListSection>
  );
}

const meta = {
  title: "Components/Layout/Rail List Section",
  component: RailListSection,
  args: {
    children: null,
    heading: "Distilleries",
  },
  argTypes: {
    action: { control: false },
    children: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <div {...stylex.props(styles.rail)}>
          <Story />
        </div>
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof RailListSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExpandableCollection: Story = {
  render: () => <ExpandableDistilleries />,
};

export const LinkedBottleCollection: Story = {
  render: () => (
    <BottleRailSection
      heading="Other bottles in this series"
      items={mockBottles.slice(0, 3).map((bottle) => toBottleListItem(bottle))}
      moreHref="#series"
      moreLabel="See all 27 bottles"
    />
  ),
};

const styles = stylex.create({
  rail: {
    width: "336px",
    maxWidth: "100%",
  },
});
