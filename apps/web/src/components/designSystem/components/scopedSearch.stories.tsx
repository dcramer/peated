"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas } from "../storyFixtures.stylex";
import { ScopedSearch } from "./scopedSearch.stylex";

const scopes = [
  { count: 232808, label: "Everything", value: "everything" },
  { count: 184204, label: "Bottles", value: "bottles" },
  { count: 3102, label: "Distillers", value: "distillers" },
  { count: 1412, label: "Brands", value: "brands" },
  { count: 288, label: "Bottlers", value: "bottlers" },
  { count: 48204, label: "Members", value: "members" },
] as const;

const uncountedScopes = scopes.map(({ label, value }) => ({ label, value }));

const meta = {
  title: "Components/Forms/Scoped Search",
  component: ScopedSearch,
  args: {
    onScopeChange: () => undefined,
    placeholder: "bottles, distillers, brands…",
    scope: "everything",
    scopes,
  },
  argTypes: {
    onScopeChange: { control: false },
    scopes: { table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof ScopedSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <ControlledScopedSearch {...args} />,
};

export const Focused: Story = {
  args: { autoFocus: true },
  render: (args) => <ControlledScopedSearch {...args} />,
};

export const ScopeMenuOpen: Story = {
  args: { defaultScopeMenuOpen: true, scopes: uncountedScopes },
  render: (args) => <ControlledScopedSearch {...args} />,
};

export const BottleScope: Story = {
  args: { scope: "bottles" },
  render: (args) => <ControlledScopedSearch {...args} />,
};

export const Populated: Story = {
  args: { defaultValue: "Lagavulin 16" },
  render: (args) => <ControlledScopedSearch {...args} />,
};

export const Disabled: Story = { args: { disabled: true } };

function ControlledScopedSearch(
  props: React.ComponentProps<typeof ScopedSearch>,
) {
  const [scope, setScope] = useState(props.scope);
  const [query, setQuery] = useState(props.defaultValue?.toString() ?? "");
  return (
    <ScopedSearch
      {...props}
      defaultValue={undefined}
      onChange={(event) => setQuery(event.currentTarget.value)}
      onClear={() => setQuery("")}
      onScopeChange={setScope}
      scope={scope}
      value={query}
    />
  );
}
