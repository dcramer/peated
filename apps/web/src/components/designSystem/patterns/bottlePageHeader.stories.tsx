import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { Button, ButtonLink, RowMenu } from "../components";
import { StoryCanvas } from "../storyFixtures.stylex";
import { BottlePageHeader } from "./bottlePageHeader.stylex";

const meta = {
  title: "Components/Bottle/Bottle Header",
  component: BottlePageHeader,
  args: {
    actions: (
      <>
        <ButtonLink href="#tasting" size="lg" variant="accent">
          Log a tasting
        </ButtonLink>
        <Button size="lg" variant="tonal">
          Add to library
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
            { href: "#similar", label: "Add similar bottle" },
            { href: "#share", label: "Share" },
          ],
        ]}
        label="Bottle record"
        variant="page"
      />
    ),
    name: "Elements L 2.0",
    notes: ["Cask strength", "Non-chill filtered"],
    score: { count: 48, score: 88.4 },
    specs: [
      { label: "ABV", value: "59.6%" },
      { label: "Age", value: null },
      { label: "Cask", value: "Ex-bourbon" },
      { label: "Release", value: "2024" },
    ],
    verdict: { pass: 3, savor: 19, sip: 12 },
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
    score: null,
    specs: [
      { label: "ABV", value: "46.0%" },
      { label: "Age", value: null },
      { label: "Cask", value: null },
      { label: "Release", value: null },
    ],
    verdict: null,
  },
};
