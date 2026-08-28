import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import {
  SiteFooter,
  type SiteFooterProps,
} from "./applicationNavigation.stylex";

const groups: SiteFooterProps["groups"] = [
  {
    label: "Database",
    links: [
      { href: "/bottles", label: "Bottles" },
      { href: "/distillers", label: "Distillers" },
      { href: "/brands", label: "Brands" },
      { href: "/bottlers", label: "Bottlers" },
      { href: "/blenders", label: "Blenders" },
      { href: "/locations", label: "Locations" },
    ],
  },
  {
    label: "You",
    links: [
      { href: "/library", label: "Library" },
      { href: "/tastings", label: "Tastings" },
      { href: "/friends", label: "Friends" },
      { href: "/settings", label: "Settings" },
    ],
  },
  {
    label: "Contribute",
    links: [
      { href: "/addBottle", label: "Record a bottle" },
      { href: "/addEntity", label: "Add a distiller" },
      { href: "/updates", label: "Recent changes" },
    ],
  },
  {
    label: "Peated",
    links: [
      { href: "/about", label: "About" },
      { href: "/about/ratings", label: "Rating systems" },
      { href: "https://github.com/peated/peated", label: "Source" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

const meta = {
  title: "Components/Navigation/Site Footer",
  component: SiteFooter,
  args: {
    coverage:
      "47,402 bottles · 3,102 distilleries · 1,891 brands · 288 bottlers · 143 blenders · 312,000 tastings",
    groups,
    provenance: "Community-edited · corrections welcome",
    referenceLinks: [
      { href: "/entities/4263/codes", label: "SMWS distillery codes" },
    ],
    statement:
      "A record of every whisky bottling, what the critics said, and what the people who drank it said.",
  },
  argTypes: {
    groups: { control: false },
    referenceLinks: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<SiteFooterProps>;

export default meta;
type Story = StoryObj<SiteFooterProps>;

export const ReferenceFooter: Story = {};
