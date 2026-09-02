import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SiteFooter, type SiteFooterProps } from "./siteFooter.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const links: SiteFooterProps["links"] = [
  { href: "/locations", label: "Locations" },
  { href: "/brands", label: "Brands" },
  { href: "/about", label: "About" },
  { href: "/updates", label: "Recent changes" },
  { href: "https://github.com/peated/peated", label: "Source" },
  { href: "/terms", label: "Terms" },
];

const meta = {
  title: "Components/Navigation/Site Footer",
  component: SiteFooter,
  args: {
    coverage:
      "47,402 bottles · 3,102 distilleries · 1,891 brands · 431 bottlers · 312,000 tastings",
    links,
    provenance: "Community-edited · corrections welcome",
    referenceLinks: [
      { href: "/bottlers/4263/codes", label: "SMWS distillery codes" },
    ],
    statement:
      "A record of whisky bottles, critic scores, and tasting notes from the people who drank them.",
  },
  argTypes: {
    links: { control: false },
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
