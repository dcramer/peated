import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ReviewQuote, TastingNote } from "./recordDetails.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Reviews & Tastings/Reviews and Tastings",
  component: ReviewQuote,
  args: {
    publication: "Whisky Advocate",
    quote:
      "Dense smoke gives way to dark fruit, salted caramel, and a dry finish.",
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof ReviewQuote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <ReviewQuote
        href="#review"
        publication="Whisky Advocate"
        publishedAt="14 Mar 2025"
        quote="Dense smoke gives way to dark fruit, salted caramel, and a dry finish."
        rating={92}
        reviewerName="Jonny McCormick"
      />
      <ReviewQuote
        publication="Malt Review"
        quote="A broad, smoky whisky with enough fruit to keep the peat from taking over."
      />
      <TastingNote
        author="dramfriend"
        authorHref="#member"
        band="outstanding"
        context="neat · 2 days ago"
        initials="DF"
        note="Charred orange, espresso, and sea salt. The smoke stays dry through the finish."
      />
      <TastingNote
        author="peathead"
        band="very_good"
        context="with water · 1 week ago"
        initials="PH"
      />
    </StoryStack>
  ),
};
