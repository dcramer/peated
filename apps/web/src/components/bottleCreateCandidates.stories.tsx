import { mockBottle } from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import {
  BottleCreateCandidates,
  BottleCreateCandidateSummary,
  type BottleCreateCandidate,
} from "./bottleCreateCandidates.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const match = {
  ...mockBottle,
  id: 51689,
  peatedId: "B51689",
  fullName: "Yamazaki 18-year-old",
  name: "18-year-old",
  brand: {
    ...mockBottle.brand,
    id: 8701,
    peatedId: "E8701",
    name: "Yamazaki",
  },
  distillers: [],
  edition: null,
  statedAge: 18,
  abv: 43,
  releaseYear: 2023,
  imageUrl: BottleImage.src,
} satisfies BottleCreateCandidate;

const anniversaryMatch = {
  ...match,
  id: 51690,
  peatedId: "B51690",
  fullName: "Yamazaki 18-year-old - 100th Anniversary Edition",
  edition: "100th Anniversary Edition",
  imageUrl: null,
} satisfies BottleCreateCandidate;

const mizunaraMatch = {
  ...match,
  id: 51691,
  peatedId: "B51691",
  fullName: "Yamazaki 18-year-old - Mizunara 2024",
  edition: "Mizunara 2024",
  releaseYear: 2024,
  abv: 48,
  imageUrl: null,
} satisfies BottleCreateCandidate;

const meta = {
  title: "Components/Bottles/Create Candidates",
  component: BottleCreateCandidates,
  args: {
    error: false,
    loading: false,
    onUse: () => undefined,
    results: [match],
  },
  argTypes: {
    onUse: { control: false },
    results: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Use after Brand and Bottle name in the creation form to compare advisory catalog matches. The component owns idle, loading, empty, failure, single-match, and multiple-match states. Choosing a match is secondary to the screen's main create action.",
      },
    },
  },
} satisfies Meta<typeof BottleCreateCandidates>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const MultipleMatches: Story = {
  args: { results: [match, anniversaryMatch, mizunaraMatch] },
};

export const EntryNotices: Story = {
  render: () => (
    <StoryStack>
      <BottleCreateCandidateSummary count={3} onReview={() => undefined} />
      <BottleCreateCandidateSummary
        count={2}
        newSinceReview
        onReview={() => undefined}
      />
      <BottleCreateCandidateSummary
        count={2}
        loading
        onReview={() => undefined}
      />
    </StoryStack>
  ),
};

export const Loading: Story = {
  args: { loading: true, results: [] },
};

export const Idle: Story = {
  args: { ready: false, results: [] },
};

export const EmptyAndFailure: Story = {
  render: (args) => (
    <StoryStack>
      <BottleCreateCandidates {...args} results={[]} />
      <BottleCreateCandidates {...args} error results={[]} />
    </StoryStack>
  ),
};
