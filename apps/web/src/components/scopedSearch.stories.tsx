"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { ScopedSearch } from "./scopedSearch.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

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

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ControlledScopedSearch {...args} />
      <ControlledScopedSearch {...args} scope="bottles" />
      <ControlledScopedSearch {...args} defaultValue="Lagavulin 16" />
      <ScopedSearch {...args} disabled />
    </StoryStack>
  ),
};

export const Focused: Story = {
  args: { autoFocus: true },
  render: (args) => <ControlledScopedSearch {...args} />,
};

export const ScopeMenuOpen: Story = {
  args: { defaultScopeMenuOpen: true, scopes: uncountedScopes },
  render: (args) => <ControlledScopedSearch {...args} />,
};

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
