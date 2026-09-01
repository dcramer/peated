"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import {
  FacetGroup,
  FilterPanel,
  FilterQuery,
  type FilterPanelProps,
} from "./filterPanel.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Search/Filter Panel",
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

export const WithoutCounts: Story = {
  render: ({ ariaLabel }) => (
    <FilterPanel ariaLabel={ariaLabel}>
      <FacetGroup
        label="Category"
        onChange={() => undefined}
        options={[
          { label: "Single malt", value: "single_malt" },
          { label: "Blended malt", value: "blended_malt" },
          { label: "Bourbon", value: "bourbon" },
        ]}
        selected="single_malt"
      />
    </FilterPanel>
  ),
};

function ControlledFilters({ ariaLabel }: FilterPanelProps) {
  const [country, setCountry] = useState("scotland");
  const [query, setQuery] = useState("");

  return (
    <FilterPanel ariaLabel={ariaLabel}>
      <FilterQuery
        label="Find a bottle"
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
