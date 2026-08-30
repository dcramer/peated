"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas } from "../storyFixtures.stylex";
import {
  FacetGroup,
  FilterPanel,
  FilterQuery,
  type FilterPanelProps,
} from "./filterPanel.stylex";

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
  render: (args) => <ControlledFilters {...args} />,
};

function ControlledFilters({ ariaLabel }: FilterPanelProps) {
  const [country, setCountry] = useState("scotland");
  const [query, setQuery] = useState("");

  return (
    <FilterPanel ariaLabel={ariaLabel}>
      <FilterQuery
        label="Find a record"
        onSubmit={setQuery}
        placeholder="Name"
        query={query}
      />
      <FacetGroup
        label="Country"
        onChange={setCountry}
        options={[
          { count: 1240, label: "Scotland", value: "scotland" },
          { count: 184, label: "Japan", value: "japan" },
          { count: 312, label: "United States", value: "united-states" },
        ]}
        selected={country}
        total={1736}
      />
    </FilterPanel>
  );
}
