"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { TextInput } from "../field.stylex";
import { StoryCanvas } from "../storyFixtures.stylex";
import {
  MemberListFilters,
  MemberListFiltersLoading,
  type MemberListFilterGroup,
} from "./memberListFilters.stylex";

type FilterState = Record<string, string>;

function getGroups(selected: FilterState): MemberListFilterGroup[] {
  const options = (
    name: string,
    values: readonly [label: string, value: string, count: number][],
  ) =>
    values.map(([label, value, count]) => ({
      count,
      label,
      selected: selected[name] === value,
      value,
    }));

  return [
    {
      filters: options("rating", [
        ["Unicorn · 95–100", "unicorn", 18],
        ["Outstanding · 90–94", "outstanding", 41],
        ["Very good · 85–89", "very_good", 96],
        ["Good · 80–84", "good", 72],
        ["Mediocre · 0–79", "mediocre", 21],
      ]),
      label: "Rating",
      name: "rating",
    },
    {
      filters: options("age", [
        ["Under 10", "under10", 12],
        ["10–12", "from10To12", 48],
        ["13–17", "from13To17", 61],
        ["18–24", "from18To24", 37],
        ["25+", "atLeast25", 22],
        ["No age stated", "unstated", 110],
      ]),
      label: "Age",
      name: "age",
      summary: "Median 16 years · oldest 50",
    },
    {
      filters: options("region", [
        ["Islay", "islay", 27],
        ["Highland", "highland", 24],
        ["Kentucky", "kentucky", 18],
      ]),
      label: "Regions",
      name: "region",
    },
  ];
}

function MemberListFiltersExample() {
  const [selected, setSelected] = useState<FilterState>({ age: "atLeast25" });

  return (
    <MemberListFilters
      groups={getGroups(selected)}
      onChange={(name, value) =>
        setSelected((current) => ({ ...current, [name]: value }))
      }
      onClear={() => setSelected({})}
      query=""
      search={
        <TextInput
          aria-label="Find in these tastings"
          placeholder="Brand or bottle"
        />
      }
      total={290}
    />
  );
}

const meta = {
  title: "Components/Members/List Filters",
  component: MemberListFilters,
  parameters: {
    docs: {
      description: {
        component:
          "Search and facet filters in the rail beside one member's Library or tastings. Each facet row shows its exact count with a bar against the shared total; a group may state one summary fact, such as the median age. PageColumns hides the rail below 760px, where ListControls shows the same groups in a drawer. Routes own queries, URL state, and navigation.",
      },
    },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof MemberListFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

// The example owns groups and selection, so the args are not live controls.
export const Overview: Story = {
  args: {
    groups: [],
    onChange: () => undefined,
    onClear: () => undefined,
    query: "",
    search: null,
  },
  parameters: { controls: { disable: true } },
  render: () => <MemberListFiltersExample />,
};

export const Loading: Story = {
  ...Overview,
  parameters: {
    ...Overview.parameters,
    docs: {
      description: {
        story:
          "Reserves the search field and the usual groups at their finished sizes while counts load. Compare it with Overview.",
      },
    },
  },
  render: () => (
    <MemberListFiltersLoading
      groups={[
        { label: "Rating", rows: 5 },
        { label: "Age", rows: 6, summary: true },
        { label: "Regions", rows: 3 },
      ]}
      searchLabel="Find in these tastings"
    />
  ),
};
