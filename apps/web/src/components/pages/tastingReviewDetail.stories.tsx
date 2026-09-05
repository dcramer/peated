import { mockTasting } from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ButtonLink } from "../button.stylex";
import { StoryCanvas } from "../storyFixtures.stylex";
import { TastingReviewDetail } from "./tastingReviewDetail.stylex";

const meta = {
  title: "Pages/Tasting and Review Detail",
  component: TastingReviewDetail,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    author: mockTasting.createdBy,
    bottle: mockTasting.bottle,
    color: mockTasting.color,
    createdAt: mockTasting.createdAt,
    footer: (
      <ButtonLink href="/login" size="sm" variant="tonal">
        Toast
      </ButtonLink>
    ),
    friends: mockTasting.friends,
    notes: mockTasting.notes,
    rating: { kind: "tasting", ratingBand: mockTasting.ratingBand },
    servingStyle: mockTasting.servingStyle,
    tags: mockTasting.tags,
  },
  argTypes: {
    footer: { control: false },
  },
} satisfies Meta<typeof TastingReviewDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const WithoutNotes: Story = {
  args: {
    color: null,
    friends: [],
    notes: null,
    servingStyle: undefined,
    tags: [],
  },
};
