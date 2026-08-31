import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button, ButtonLink, RowMenu } from "..";
import BottleImage from "../../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { StoryCanvas } from "../storyFixtures.stylex";
import { BottlePageHeader } from "./bottlePageHeader.stylex";

const meta = {
  title: "Components/Bottles/Bottle Header",
  component: BottlePageHeader,
  args: {
    actions: (
      <>
        <ButtonLink href="#tasting" size="lg" variant="accent">
          Log a tasting
        </ButtonLink>
        <Button size="lg" variant="tonal">
          Add to Library
        </Button>
      </>
    ),
    brand: "Laphroaig",
    brandHref: "/entities/809",
    detail: "Islay · single malt · official bottling",
    id: "B19936",
    imageUrl: BottleImage.src,
    memberStatus: { hasTasted: true, isLibrary: false },
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
    notes: ["Cask strength", "Non-chill filtered"],
    bands: {
      counts: {
        good: 8,
        mediocre: 3,
        outstanding: 19,
        unicorn: 6,
        very_good: 12,
      },
      showCounts: true,
    },
    score: { count: 48, high: 96, low: 78, median: 88 },
    specs: [
      { label: "ABV", value: "59.6%" },
      { label: "Age", value: null },
      { label: "Cask", value: "Ex-bourbon" },
      { label: "Release", value: "2024" },
    ],
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

export const MissingImage: Story = {
  args: {
    brand: "Lagavulin",
    brandHref: "/entities/245",
    detail: "Islay · single malt · official bottling",
    id: "B00042",
    imageUrl: null,
    name: "16-year-old",
    notes: ["Sherry cask finish"],
  },
};

export const LongName: Story = {
  args: {
    brand: "The Scotch Malt Whisky Society",
    brandHref: "/entities/3417",
    detail: "Highland · single malt · independent bottling",
    id: "B49748",
    name: "SMWS Highland peaty potion",
    notes: [],
    specs: [
      { label: "ABV", value: "50.0%" },
      { label: "Age", value: "10 years" },
      { label: "Cask", value: "1st fill barrels and oloroso sherry hogsheads" },
      { label: "Release", value: "Batch 42" },
    ],
  },
};

export const ThinData: Story = {
  args: {
    actions: null,
    brand: "Port Ellen",
    brandHref: "/entities/214",
    detail: "Islay · single malt",
    id: "B08172",
    imageUrl: null,
    memberStatus: undefined,
    menu: null,
    name: "Independent bottling",
    notes: [],
    bands: null,
    score: null,
    specs: [
      { label: "ABV", value: "46.0%" },
      { label: "Age", value: null },
      { label: "Cask", value: null },
      { label: "Release", value: null },
    ],
  },
};
