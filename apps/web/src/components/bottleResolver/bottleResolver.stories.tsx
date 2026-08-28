import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { StoryCanvas } from "../designSystem/storyFixtures.stylex";
import {
  PhotoLoadingState,
  PhotoReadFailureState,
  PhotoUploadState,
} from "./states";

type ResolverState = "ready" | "reading" | "failure";

function BottleResolverState({ state }: { state: ResolverState }) {
  if (state === "reading") {
    return (
      <PhotoLoadingState
        loadingMessage="Checking the dusty shelf"
        previewUrl={BottleImage.src}
        searchHref="#search"
      />
    );
  }

  if (state === "failure") {
    return (
      <PhotoReadFailureState
        createBottleHref="#create"
        onStartOver={() => undefined}
        photoError="We couldn't read that photo. Search can still find the bottle, or you can try another photo."
        previewUrl={BottleImage.src}
        searchHref="#search"
        searchLabel="Search Bottles"
        trace={null}
      />
    );
  }

  return (
    <PhotoUploadState onSelectPhoto={() => undefined} searchHref="#search" />
  );
}

const meta = {
  title: "Components/Forms/Bottle Resolver",
  component: BottleResolverState,
  args: { state: "ready" },
  argTypes: {
    state: {
      control: "select",
      options: ["ready", "reading", "failure"],
    },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof BottleResolverState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
