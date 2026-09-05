import { mockTastings } from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ButtonLink } from "../button.stylex";
import { RowMenu } from "../rowMenu.stylex";
import { StoryCanvas } from "../storyFixtures.stylex";
import {
  TastingReviewDetail,
  TastingReviewDetailLoading,
} from "./tastingReviewDetail.stylex";

const photoTasting = mockTastings[6]!;

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
    author: photoTasting.createdBy,
    bottle: photoTasting.bottle,
    color: photoTasting.color,
    createdAt: photoTasting.createdAt,
    footer: (
      <ButtonLink href="/login" size="sm" variant="tonal">
        Toast
      </ButtonLink>
    ),
    friends: photoTasting.friends,
    menu: (
      <RowMenu
        groups={[
          [{ href: "/tastings/1/edit", label: "Edit tasting" }],
          [{ label: "Delete tasting", onSelect: () => undefined }],
        ]}
        label="Tasting"
        triggerVariant="text"
      />
    ),
    notes: photoTasting.notes,
    photoUrl: photoTasting.imageUrl,
    rating: { kind: "tasting", ratingBand: photoTasting.ratingBand },
    servingStyle: photoTasting.servingStyle,
    tags: photoTasting.tags,
  },
  argTypes: {
    footer: { control: false },
    menu: { control: false },
  },
} satisfies Meta<typeof TastingReviewDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const Loading: Story = {
  render: () => <TastingReviewDetailLoading label="Loading tasting details" />,
};

export const WithoutNotes: Story = {
  args: {
    color: null,
    friends: [],
    notes: null,
    servingStyle: undefined,
    tags: [],
  },
};
