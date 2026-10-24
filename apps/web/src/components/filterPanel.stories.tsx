"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import {
  FacetGroup,
  FilterPanel,
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
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("scotland");
  const [query, setQuery] = useState("");

  return (
    <FilterPanel
      ariaLabel={ariaLabel}
      onClear={
        age || country || query
          ? () => {
              setAge("");
              setCountry("");
              setQuery("");
            }
          : undefined
      }
      query={{
        label: "Find a bottle",
        onSubmit: setQuery,
        placeholder: "Name",
        query,
      }}
    >
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
      <FacetGroup
        label="Age"
        onChange={setAge}
        options={[
          { count: 212, label: "Under 10", value: "under10" },
          { count: 498, label: "10–12", value: "from10To12" },
          { count: 361, label: "13–17", value: "from13To17" },
          { count: 137, label: "18–24", value: "from18To24" },
          { count: 52, label: "25+", value: "atLeast25" },
          { count: 476, label: "No age stated", value: "unstated" },
        ]}
        selected={age}
        summary="Median 12 years · oldest 50"
        total={1736}
      />
    </FilterPanel>
  );
}
