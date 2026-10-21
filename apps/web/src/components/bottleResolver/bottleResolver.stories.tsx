import { mockBottle } from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { SearchBox } from "@peated/web/components/searchBox.stylex";
import BottleImage from "../../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { StoryCanvas } from "../storyFixtures.stylex";
import { EMPTY_PHOTO_PROGRESS, type PhotoProgress } from "./helpers";
import {
  PhotoLoadingState,
  PhotoReadFailureState,
  PhotoUploadState,
} from "./states";

type ResolverState = "ready" | "reading" | "matches" | "failure";

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
                provenance: [{ name: "Single Malt" }],
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

  if (state === "failure") {
    return (
      <PhotoReadFailureState
        createBottleHref="#create"
        onStartOver={() => undefined}
        photoError="Search can still find the bottle, or you can try another photo."
        previewUrl={BottleImage.src}
        searchHref="#search"
        searchLabel="Search bottles"
        trace={null}
      />
    );
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
      options: ["ready", "reading", "matches", "failure"],
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
