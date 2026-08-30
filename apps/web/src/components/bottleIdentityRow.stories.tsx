import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { BottleIdentityRow } from "./bottleIdentityRow.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

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
    <ItemList ariaLabel="Bottle identity examples">
      <ItemListItem>
        <BottleIdentityRow {...args} />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow
          brand="Lagavulin"
          brandHref="/entities/245"
          href="/bottles/42"
          imageUrl={null}
          metadata={["16 years", "43.0% ABV", "Distillers Edition"]}
          name="Lagavulin 16-year-old"
          relatedReleases={{ count: 3, href: "/bottles/42/releases" }}
        />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow {...args} hasTasted isLibrary />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow {...args} isLibrary />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow {...args} hasTasted />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow
          brand="Bruichladdich"
          brandHref="/entities/213"
          href="/bottles/18481"
          imageUrl={null}
          metadata={["61.5% ABV", "2024 release", "Islay barley"]}
          name="Octomore Edition 15.3 Islay Barley Super Heavily Peated"
        />
      </ItemListItem>
    </ItemList>
  ),
};

export const Surface: Story = {
  render: (args) => (
    <ItemList ariaLabel="Bottle identity surface examples" variant="surface">
      <ItemListItem>
        <BottleIdentityRow {...args} variant="surface" />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow
          {...args}
          imageUrl={null}
          name="Lagavulin 16-year-old"
          variant="surface"
        />
      </ItemListItem>
    </ItemList>
  ),
};

export const InteractionStates: Story = {
  render: (args) => (
    <StoryStack>
      <ItemList ariaLabel="Bottle row interaction states">
        <ItemListItem id="bottle-row-default">
          <BottleIdentityRow {...args} name="Default" />
        </ItemListItem>
        <ItemListItem id="bottle-row-hovered">
          <BottleIdentityRow {...args} name="Hovered" />
        </ItemListItem>
        <ItemListItem id="bottle-row-focused">
          <BottleIdentityRow {...args} name="Keyboard focused" />
        </ItemListItem>
        <ItemListItem id="bottle-row-nested">
          <BottleIdentityRow
            {...args}
            name="Primary bottle with brand and release links"
            relatedReleases={{ count: 3, href: "#releases" }}
          />
        </ItemListItem>
        <ItemListItem id="bottle-row-pressed">
          <BottleIdentityRow {...args} name="Pressed" />
        </ItemListItem>
      </ItemList>
    </StoryStack>
  ),
  parameters: {
    pseudo: {
      active: ["#bottle-row-pressed > div"],
      focusWithin: ["#bottle-row-focused > div"],
      hover: ["#bottle-row-hovered > div"],
    },
  },
};
