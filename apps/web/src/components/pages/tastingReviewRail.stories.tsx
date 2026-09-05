import { mockBottle, mockTasting } from "@peated/server/orpc/mock/fixtures";
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
    author: mockTasting.createdBy,
    bottle: mockBottle,
    currentTastingId: mockTasting.id,
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
  },
  parameters: {
    docs: {
      description: {
        component:
          "The sidebar used by tasting and review pages, shown at its 336px desktop width. Long names retain a full accessible label and title, with a two-line visual limit. Dates and optional ratings share one line below the name. Includes long names, missing images, and an unrated tasting using fixture data.",
      },
    },
  },
} satisfies Meta<typeof TastingReviewRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

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
