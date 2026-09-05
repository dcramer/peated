import {
  mockBottle,
  mockTasting,
  mockTastings,
} from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";

import { space } from "../../styles/tokens.stylex";
import { TastingReviewRail } from "./tastingReviewRail.stylex";

const longNameBottle = {
  ...mockBottle,
  brand: { ...mockBottle.brand, name: "The Balvenie", shortName: null },
  name: "A Collection of Curious Casks French Pineau Cask Finish - Cask No. 55",
  group: undefined,
  series: null,
  imageUrl: null,
};
const photoTasting = mockTastings[6]!;

const meta = {
  title: "Components/Reviews & Tastings/Tasting Review Rail",
  component: TastingReviewRail,
  decorators: [
    (Story) => (
      <aside {...stylex.props(styles.rail)}>
        <Story />
      </aside>
    ),
  ],
  args: {
    author: photoTasting.createdBy,
    bottle: photoTasting.bottle,
    currentTastingId: photoTasting.id,
    externalReviews: [],
    memberReviews: [],
    memberTastings: [
      mockTasting,
      { ...mockTasting, id: 9611, bottle: longNameBottle },
      {
        ...mockTasting,
        id: 9612,
        ratingBand: null,
        bottle: {
          ...longNameBottle,
          brand: {
            ...mockBottle.brand,
            name: "Bruichladdich",
            shortName: null,
          },
          name: "Octomore Edition 15.3 Islay Barley Super Heavily Peated",
        },
      },
      { ...mockTasting, id: 9613 },
    ],
    photoUrl: photoTasting.imageUrl,
  },
  parameters: {
    docs: {
      description: {
        component:
          "The sidebar used by tasting and review pages, shown at its 336px desktop width. The large image uses the tasting or review photo when present; otherwise it uses the catalog Bottle image. The Bottle link uses the shared sidebar identity without a repeated heading. Long names retain a full accessible label and title, with a two-line visual limit. Dates and optional ratings share one line below the name.",
      },
    },
  },
} satisfies Meta<typeof TastingReviewRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const BottleImage: Story = {
  args: { photoUrl: null },
};

export const WithoutImage: Story = {
  args: { bottle: mockBottle, photoUrl: null },
};

export const Empty: Story = {
  args: { memberTastings: [] },
};

const styles = stylex.create({
  rail: {
    display: "flex",
    width: "336px",
    maxWidth: "100%",
    flexDirection: "column",
    gap: space.x8,
  },
});
