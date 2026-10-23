import { mockBottle } from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@peated/web/components/button.stylex";
import { SearchBox } from "@peated/web/components/searchBox.stylex";
import BottleImage from "../../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { StoryCanvas } from "../storyFixtures.stylex";
import { EMPTY_PHOTO_PROGRESS, type PhotoProgress } from "./helpers";
import {
  PhotoFallbackState,
  PhotoLoadingState,
  PhotoUploadState,
} from "./states";

type ResolverState =
  | "ready"
  | "reading"
  | "matches"
  | "failure"
  | "failure-with-matches"
  | "suggestions"
  | "new-bottle";

const suggestedBottles = [
  { ...mockBottle, imageUrl: BottleImage.src },
  {
    ...mockBottle,
    id: mockBottle.id + 1,
    fullName: `${mockBottle.brand.name} 10-year-old Cask Strength`,
    name: "10-year-old Cask Strength",
    statedAge: 10,
    abv: 58.6,
    imageUrl: null,
  },
];

const progressWithMatches: PhotoProgress = {
  pendingImage: {
    id: "story-pending-image",
    imageUrl: BottleImage.src,
    expiresAt: "2099-01-01T00:00:00.000Z",
  },
  imageEvidence: {
    sourceImageId: "story-pending-image",
    extractors: [],
    fieldCandidates: {
      brand: {
        value: "Laphroaig",
        confidence: 0.75,
        sourceExtractorIndexes: [0],
      },
      expression: {
        value: "Elements L2.0",
        confidence: 0.75,
        sourceExtractorIndexes: [0],
      },
      abv: { value: 58.4, confidence: 0.75, sourceExtractorIndexes: [0] },
    },
    photoSuitability: {
      isSingleBottlePhoto: true,
      labelReadable: true,
      suitableAsTastingImage: true,
      suitableAsBottleImage: true,
    },
    conflicts: [],
  },
  candidates: [{ ...mockBottle, imageUrl: BottleImage.src }],
  step: "checking_web",
};

function BottleSearch() {
  const [query, setQuery] = useState("");
  const groups = query.trim()
    ? [
        {
          id: "bottles",
          items: [
            {
              href: "#bottle-42",
              id: "bottle-42",
              bottle: {
                metadata: ["12 years", "57.2%"],
              },
              title: "Springbank 12-year-old Cask Strength",
              visual: {
                kind: "bottle" as const,
                label: "Springbank 12-year-old Cask Strength bottle",
              },
            },
          ],
          label: "Bottles",
          total: 1,
        },
      ]
    : [];

  return (
    <SearchBox
      contribution={
        query.trim()
          ? {
              description: `Can't find “${query.trim()}”?`,
              href: `#add-${encodeURIComponent(query.trim())}`,
              label: "Add a new bottle",
            }
          : undefined
      }
      groups={groups}
      onQueryChange={setQuery}
      onScopeChange={() => undefined}
      placement="page"
      placeholder="Search by bottle, brand, or distiller…"
      query={query}
      scope="bottles"
      scopes={[{ label: "Bottles", value: "bottles" }]}
    />
  );
}

function BottleResolverState({ state }: { state: ResolverState }) {
  const search = <BottleSearch />;

  if (state === "reading" || state === "matches") {
    return (
      <PhotoLoadingState
        identifying
        onPickMatch={() => undefined}
        onStartOver={() => undefined}
        pickingBottleId={null}
        previewUrl={BottleImage.src}
        progress={
          state === "matches" ? progressWithMatches : EMPTY_PHOTO_PROGRESS
        }
        search={search}
        searchHref="#search"
        slow={state === "matches"}
      />
    );
  }

  if (state !== "ready") {
    const fallback = {
      onPickSuggestion: () => undefined,
      createBottleHref: "#create",
      onStartOver: () => undefined,
      previewUrl: BottleImage.src,
      result: null,
      searchHref: "#search",
    };
    if (state === "failure") {
      return (
        <PhotoFallbackState
          {...fallback}
          alert
          reason="We can't check photos right now. Search by name or try again later."
          suggestions={[]}
        />
      );
    }
    if (state === "failure-with-matches") {
      return (
        <PhotoFallbackState
          {...fallback}
          alert
          reason="We can't check photos right now. Search by name or try again later."
          result={
            progressWithMatches.imageEvidence && {
              imageEvidence: progressWithMatches.imageEvidence,
            }
          }
          suggestions={progressWithMatches.candidates}
        />
      );
    }
    if (state === "suggestions") {
      return (
        <PhotoFallbackState
          {...fallback}
          reason="Thanks, we've noted the wrong match."
          suggestions={suggestedBottles}
        />
      );
    }
    if (state === "new-bottle") {
      return (
        <PhotoFallbackState
          {...fallback}
          proposal={{
            name: "Laphroaig Elements L2.0",
            actions: (
              <Button fullWidth variant="accent">
                <Plus aria-hidden="true" size={16} />
                Add a bottle
              </Button>
            ),
          }}
          reason="This label looks new to Peated. Check the details before you add it."
          suggestions={suggestedBottles.slice(0, 1)}
        />
      );
    }
  }

  return (
    <PhotoUploadState
      onSelectPhoto={() => undefined}
      search={search}
      searchHref="#search"
      title="Find a bottle"
    />
  );
}

const meta = {
  title: "Components/Forms/Bottle Resolver",
  component: BottleResolverState,
  args: { state: "ready" },
  argTypes: {
    state: {
      control: "select",
      options: [
        "ready",
        "reading",
        "matches",
        "failure",
        "failure-with-matches",
        "suggestions",
        "new-bottle",
      ],
    },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof BottleResolverState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

/** A wrong match, with the lookup's other candidates to choose from. */
export const Suggestions: Story = { args: { state: "suggestions" } };

/** An approved new Bottle, with one other candidate above it. */
export const NewBottle: Story = { args: { state: "new-bottle" } };

/** The photo could not be checked, so there is nothing to suggest. */
export const Failure: Story = { args: { state: "failure" } };

/**
 * The lookup failed after it sent likely matches and label facts, so those
 * stay as suggestions and fill in a new Bottle.
 */
export const FailureWithMatches: Story = {
  args: { state: "failure-with-matches" },
};
