import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ButtonLink, EmptyState, VerdictDistributionBar } from "../components";
import { StoryCanvas } from "../storyFixtures.stylex";
import { BottleOverview } from "./bottleOverview.stylex";

const meta = {
  title: "Patterns/Bottle/Overview",
  component: BottleOverview,
  args: {
    criticReviewCount: 12,
    criticReviewDetail: "Newest first",
    criticReviews: [
      {
        href: "#whisky-advocate",
        publication: "Whisky Advocate",
        publishedAt: "2024 review",
        score: { display: "91/100", scale: 100, value: 91 },
        summary:
          "Smoke arrives first, then dried fruit and a long saline finish.",
      },
      {
        href: "#malt-review",
        publication: "Malt Review",
        publishedAt: "2023 review",
        score: { display: "8/10", scale: 10, value: 8 },
        summary:
          "Sweeter through the middle, with ash and sea salt returning on the finish.",
      },
      {
        publication: "The Whisky Wash",
        publishedAt: "2023 review",
        score: { display: "4.5/5", scale: 5, value: 4.5 },
      },
    ],
    declaredFacts: [
      { label: "Phenols", value: null },
      { label: "Colouring", value: "E150a" },
      { label: "Filtration", value: "Chill filtered" },
      { label: "Bottling", value: "Official" },
    ],
    moreTastingsHref: "/bottles/19936/tastings",
    recommendationIntro:
      "People who liked this bottle also liked these bottles.",
    recommendations: [
      {
        end: <VerdictDistributionBar pass={6} savor={74} sip={20} />,
        href: "/bottles/122",
        metadata: "Islay · 54.2% ABV",
        name: "Ardbeg Uigeadail",
      },
      {
        end: <VerdictDistributionBar pass={4} savor={63} sip={18} />,
        href: "/bottles/481",
        metadata: "Islay · 50.0% ABV",
        name: "Port Charlotte 10-year-old",
      },
      {
        end: <VerdictDistributionBar pass={8} savor={61} sip={31} />,
        href: "/bottles/219",
        metadata: "Islay · 46.0% ABV",
        name: "Kilchoman Sanaig",
      },
    ],
    tastingCount: 2841,
    tastings: [
      {
        author: "j.macleod",
        authorHref: "/users/41",
        comment: "Bonfire on a wet beach. The smoke still sets the bar.",
        date: "3 days ago",
        members: [
          {
            metadata: "Neat",
            name: "Laphroaig Elements L 2.0",
            notes: ["Ash", "Sea salt"],
            verdict: "savor",
          },
        ],
      },
      {
        author: "caskstrength_k",
        authorHref: "/users/82",
        comment: "Sweeter than expected, then a long ashy finish.",
        date: "1 week ago",
        members: [
          {
            name: "Laphroaig Elements L 2.0",
            notes: ["Smoke", "Dried fruit"],
            verdict: "sip",
          },
        ],
      },
    ],
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="page">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof BottleOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutRecommendations: Story = {
  args: {
    recommendationIntro: undefined,
    recommendations: [],
  },
};

export const ThinData: Story = {
  args: {
    criticReviewCount: 1,
    criticReviewDetail: undefined,
    criticReviews: [
      {
        publication: "Whisky Advocate",
        publishedAt: "2024 review",
        score: null,
      },
    ],
    declaredFacts: [
      { label: "Phenols", value: null },
      { label: "Colouring", value: null },
      { label: "Filtration", value: null },
      { label: "Bottling", value: "Official" },
    ],
    moreTastingsHref: undefined,
    recommendationIntro: undefined,
    recommendations: [],
    tastingCount: undefined,
    tastings: [],
  },
};

export const Empty: Story = {
  args: {
    criticReviewCount: undefined,
    criticReviewDetail: undefined,
    criticReviews: [],
    mainState: (
      <EmptyState
        action={
          <ButtonLink href="#tasting" size="sm" variant="accent">
            Log the first tasting
          </ButtonLink>
        }
        heading="No reviews or tastings yet"
      >
        This bottle has no published critic reviews or community tastings.
      </EmptyState>
    ),
    moreTastingsHref: undefined,
    tastingCount: 0,
    tastings: [],
  },
};
