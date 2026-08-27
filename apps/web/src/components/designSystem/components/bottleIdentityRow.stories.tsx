import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { BottleIdentityRow } from "./bottleIdentityRow.stylex";

const meta = {
  title: "Components/Data Display/Bottle Identity Row",
  component: BottleIdentityRow,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    brand: "Laphroaig",
    brandHref: "/entities/809",
    href: "/bottles/19936",
    imageUrl: BottleImage.src,
    metadata: ["Single malt", "Islay"],
    name: "Elements L 2.0",
  },
} satisfies Meta<typeof BottleIdentityRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <BottleIdentityRow {...args} />
      <BottleIdentityRow
        brand="Lagavulin"
        brandHref="/entities/245"
        href="/bottles/42"
        imageUrl={null}
        metadata={["16 years", "43.0% ABV", "Distillers Edition"]}
        name="Lagavulin 16-year-old"
        relatedReleases={{ count: 3, href: "/bottles/42/releases" }}
      />
      <BottleIdentityRow {...args} hasTasted isLibrary />
      <BottleIdentityRow {...args} isLibrary />
      <BottleIdentityRow {...args} hasTasted />
      <BottleIdentityRow
        brand="Bruichladdich"
        brandHref="/entities/213"
        href="/bottles/18481"
        imageUrl={null}
        metadata={["61.5% ABV", "2024 release", "Islay barley"]}
        name="Octomore Edition 15.3 Islay Barley Super Heavily Peated"
      />
    </StoryStack>
  ),
};
