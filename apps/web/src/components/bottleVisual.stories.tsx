import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { BottleVisual } from "./bottleVisual.stylex";
import { StoryCanvas, StoryRow } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Bottles/Bottle Visual",
  component: BottleVisual,
  args: {
    imageUrl: BottleImage.src,
    label: "Laphroaig Elements L 2.0",
    size: "md",
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["xs", "sm", "md", "activity", "lg", "xl"],
    },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: `Bottle image primitive: contains the full image on white and uses Peated's bottle glyph when imageUrl is absent. Use BottleIdentityRow for a bottle row; it chooses the thumbnail size for you.

| Size | Use |
| --- | --- |
| xs | Single-line library additions (24 × 32px). |
| sm | Two-line sidebar rails (32 × 46px). |
| md (default) | Standard rows, search, and selection (48 × 64px; 42 × 58px on mobile). |
| activity | Tastings and reviews in the community feed. Uses a framed 96px square in wide feed columns, the usual 48 × 64px frame in a desktop sidebar, and 42 × 58px on mobile. Catalog images contain the full bottle; personal-photo thumbnails can use fit="cover". Missing images use a neutral frame with the standard bottle glyph. |
| lg | Detail media (132 × 176px; 80 × 120px on mobile). |
| xl | Full-width detail media with a 4:5 frame. |

Omit label when adjacent text already names the bottle. Supply label for a standalone image. expandable requires both an image and a label; use it in detail media, outside another link or button.`,
      },
    },
  },
} satisfies Meta<typeof BottleVisual>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryRow>
      <BottleVisual {...args} />
      <BottleVisual {...args} imageUrl={null} />
    </StoryRow>
  ),
};

export const Expandable: Story = {
  args: { expandable: true, size: "lg" },
};
