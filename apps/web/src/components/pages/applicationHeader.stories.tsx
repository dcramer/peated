import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CircleUserRound } from "lucide-react";
import { useState } from "react";

import { ApplicationHeader } from "../applicationHeader.stylex";
import { Button, ButtonLink } from "../button.stylex";
import { ScopedSearch } from "../scopedSearch.stylex";
import { SearchBox } from "../searchBox.stylex";
import { searchResultGroups } from "../storyData";

const databaseItems = [
  { href: "/bottles", label: "Bottles" },
  { href: "/locations", label: "Locations" },
  { href: "/distillers", label: "Distillers" },
  { href: "/brands", label: "Brands" },
  { href: "/bottlers", label: "Bottlers" },
] as const;

const personalItems = [
  { count: 41, href: "/library", label: "Library" },
  { count: 412, href: "/tastings", label: "Tastings" },
  { count: 38, href: "/friends", label: "Friends" },
] as const;

const scopes = [
  { label: "Everything", value: "all" },
  { label: "Bottles", value: "bottles" },
  { label: "Distillers", value: "distillers" },
] as const;

function HeaderExample({
  publicHome = false,
  searchOpen = false,
  signedIn = true,
}: {
  publicHome?: boolean;
  searchOpen?: boolean;
  signedIn?: boolean;
}) {
  const [scope, setScope] = useState("all");
  const [query, setQuery] = useState(searchOpen ? "lagav" : "");

  return (
    <ApplicationHeader
      account={
        signedIn ? <CircleUserRound aria-hidden="true" size={18} /> : undefined
      }
      accountItems={
        signedIn
          ? [
              { href: "/profile", label: "Profile" },
              { href: "/settings", label: "Settings" },
              { label: "Sign out", onSelect: () => undefined },
            ]
          : undefined
      }
      action={
        signedIn ? (
          <Button size="sm" variant="accent">
            Log a tasting
          </Button>
        ) : (
          <>
            <ButtonLink href="/login" size="sm" variant="text">
              Sign in
            </ButtonLink>
            <ButtonLink href="/register" size="sm" variant="default">
              Create account
            </ButtonLink>
          </>
        )
      }
      currentHref="/bottles"
      databaseItems={databaseItems}
      defaultSearchOpen={searchOpen}
      navigationPlacement={publicHome ? "inline" : "separate"}
      personalItems={signedIn ? personalItems : []}
      search={
        publicHome ? undefined : searchOpen ? (
          <SearchBox
            contribution={{
              description: "Not here?",
              href: "#record",
              label: "Add this bottle",
            }}
            defaultOpen
            groups={searchResultGroups}
            onQueryChange={setQuery}
            onResultSelect={() => undefined}
            onScopeChange={setScope}
            placeholder="bottles, distillers, brands…"
            query={query}
            scope={scope}
            scopes={scopes}
          />
        ) : (
          <ScopedSearch
            aria-label="Search Peated"
            onScopeChange={setScope}
            placeholder="bottles, distillers, brands…"
            scope={scope}
            scopes={scopes}
          />
        )
      }
    />
  );
}

const meta = {
  title: "Components/Navigation/Application Header",
  component: ApplicationHeader,
  args: {
    account: null,
    action: null,
    currentHref: "/bottles",
    databaseItems,
    personalItems,
    search: null,
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ApplicationHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedIn: Story = { render: () => <HeaderExample /> };

export const SignedOut: Story = {
  render: () => <HeaderExample signedIn={false} />,
};

export const SearchOpen: Story = {
  render: () => <HeaderExample searchOpen />,
};
