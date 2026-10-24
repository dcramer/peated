"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { TextInput } from "../field.stylex";
import { StoryCanvas } from "../storyFixtures.stylex";
import {
  MemberListFilters,
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

function MemberListFiltersExample({ mode }: { mode: "mobile" | "rail" }) {
  const [selected, setSelected] = useState<FilterState>({ age: "atLeast25" });

  return (
    <MemberListFilters
      groups={getGroups(selected)}
      mobileLabel="Filter tastings"
      mode={mode}
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
          "Search and facet filters beside one member's Library or tastings. Each facet row shows its exact count with a bar against the shared total; a group may state one summary fact, such as the median age. Rail mode sits beside the list; mobile mode collapses the same content under the route's label. Routes own queries, URL state, and navigation.",
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

// The example owns groups and selection, so only `mode` is a live control.
export const Overview: Story = {
  args: {
    groups: [],
    mobileLabel: "Filter tastings",
    mode: "rail",
    onChange: () => undefined,
    onClear: () => undefined,
    query: "",
    search: null,
  },
  argTypes: {
    groups: { control: false },
    mobileLabel: { control: false },
    query: { control: false },
    search: { control: false },
  },
  render: ({ mode }) => <MemberListFiltersExample mode={mode} />,
};

export const Mobile: Story = {
  ...Overview,
  args: { ...Overview.args, mode: "mobile" },
  globals: { viewport: { isRotated: false, value: "peatedPhone" } },
  parameters: {
    docs: {
      description: {
        story:
          "Below 760px the rail is hidden and the same filters open from a summary row above the list.",
      },
    },
  },
};
