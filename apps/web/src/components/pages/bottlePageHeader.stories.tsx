import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button, ButtonLink, RowMenu } from "..";
import { StoryCanvas } from "../storyFixtures.stylex";
import { BottlePageHeader } from "./bottlePageHeader.stylex";

const meta = {
  title: "Components/Bottles/Bottle Header",
  component: BottlePageHeader,
  args: {
    actions: (
      <>
        <ButtonLink href="#tasting" size="lg" variant="accent">
          Rate this bottle
        </ButtonLink>
        <Button size="lg" variant="tonal">
          Add to Library
        </Button>
      </>
    ),
    brand: "Laphroaig",
    brandHref: "/entities/809",
    metadata: "Laphroaig Distillery",
    menu: (
      <RowMenu
        groups={[
          [
            { href: "#similar", label: "Add a similar bottle" },
            { href: "#share", label: "Share" },
          ],
        ]}
        label="Bottle actions"
        variant="page"
      />
    ),
    name: "Elements L 2.0",
    rating: {
      externalScoreCount: 2,
      memberScoreCount: 3,
      median: 91,
      tastingCounts: {
        good: 8,
        mediocre: 3,
        outstanding: 19,
        unicorn: 6,
        very_good: 12,
      },
    },
  },
  argTypes: {
    actions: { control: false },
    menu: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="page">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof BottlePageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TastingOnly: Story = {
  args: {
    brand: "New Riff",
    brandHref: "/entities/1697",
    metadata: "New Riff Distilling",
    name: "6-year-old Malted Rye",
    rating: {
      tastingCounts: { very_good: 2 },
    },
  },
};

export const LongName: Story = {
  args: {
    brand: "The Scotch Malt Whisky Society",
    brandHref: "/entities/3417",
    metadata: "Caol Ila Distillery",
    name: "SMWS Highland peaty potion",
  },
};

export const ThinData: Story = {
  args: {
    actions: null,
    brand: "Port Ellen",
    brandHref: "/entities/214",
    metadata: "Port Ellen Distillery",
    menu: null,
    name: "Independent bottling",
    rating: null,
  },
};
