import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SiteFooter, type SiteFooterProps } from "./siteFooter.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const groups: SiteFooterProps["groups"] = [
  {
    label: "Explore",
    links: [
      { href: "/locations", label: "Locations" },
      { href: "/brands", label: "Brands" },
      { href: "/events", label: "Whisky events" },
    ],
  },
  {
    label: "Reference",
    links: [
      { href: "/about/categories", label: "Whisky categories" },
      { href: "/about/tasting-wheel", label: "Tasting wheel" },
      { href: "/about/ratings", label: "Rating guide" },
      { href: "/bottlers/4263/codes", label: "SMWS distillery codes" },
    ],
  },
  {
    label: "Project",
    links: [
      { href: "/about", label: "About" },
      { href: "/updates", label: "Recent changes" },
      { href: "/about/api", label: "API" },
      { href: "https://github.com/peated/peated", label: "Source" },
    ],
  },
];

const meta = {
  title: "Components/Navigation/Site Footer",
  component: SiteFooter,
  args: {
    coverage:
      "47,402 bottles · 3,102 distilleries · 1,891 brands · 431 bottlers · 312,000 tastings",
    groups,
    legalLinks: [{ href: "/terms", label: "Terms" }],
    provenance: "Edited by members · corrections welcome",
    responsibility: "Drink responsibly",
    statement:
      "A public record of whisky bottles, critic scores, and tasting notes from the people who drank them.",
  },
  argTypes: {
    groups: { control: false },
    legalLinks: { control: false },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Footer links form three columns on desktop. Below 640px, each group becomes a collapsed native disclosure; description, coverage, and provenance are hidden. Legal links and responsible-drinking copy remain visible. Links and disclosure summaries show hover, pressed, and keyboard-focus states.",
      },
    },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="page">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<SiteFooterProps>;

export default meta;
type Story = StoryObj<SiteFooterProps>;

export const Overview: Story = {};
