"use client";

import type { SERVING_STYLE_LIST } from "@peated/server/constants";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useState } from "react";

import type { MemberPickerOption } from "./memberPicker.stylex";
import type { RatingBand } from "./scoring.stylex";
import { memberOptions } from "./storyData";
import { StoryCanvas } from "./storyFixtures.stylex";
import { TastingFormModeChoice } from "./tastingFormModeChoice.stylex";
import {
  MemberReviewNotesStep,
  MemberReviewScoreStep,
  TastingNotesStep,
  TastingPourStep,
  TastingRatingStep,
} from "./tastingFormSteps.stylex";

type Step = "choose" | "notes" | "review-notes" | "pour" | "rating" | "score";

function TastingStepExample({
  step,
  disabled,
}: {
  step: Step;
  disabled: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<readonly string[]>([]);
  const [noseTags, setNoseTags] = useState<readonly string[]>([]);
  const [palateTags, setPalateTags] = useState<readonly string[]>([]);
  const [finishTags, setFinishTags] = useState<readonly string[]>([]);
  const [color, setColor] = useState<number | null>(null);
  const [serving, setServing] = useState<
    (typeof SERVING_STYLE_LIST)[number] | null
  >(null);
  const [friends, setFriends] = useState<readonly MemberPickerOption[]>([]);
  const [rating, setRating] = useState<RatingBand | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [photo, setPhoto] = useState<string>();

  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo);
    },
    [photo],
  );

  if (step === "choose")
    return (
      <TastingFormModeChoice disabled={disabled} onChange={() => undefined} />
    );
  if (step === "notes")
    return (
      <TastingNotesStep
        notes={{
          id: "tasting-notes",
          value: notes,
          disabled,
          onChange: (event) => setNotes(event.currentTarget.value),
        }}
        flavors={{
          id: "tasting-flavors",
          notes: [
            { name: "Smoke", category: "Peaty", common: true, usageCount: 1 },
            { name: "Vanilla", category: "Sweet", common: true, usageCount: 1 },
          ],
          onChange: setTags,
          value: tags,
        }}
      />
    );
  if (step === "review-notes")
    return (
      <MemberReviewNotesStep
        notes={{
          id: "review-notes",
          value: notes,
          disabled,
          onChange: (event) => setNotes(event.currentTarget.value),
        }}
        nose={{
          id: "review-nose",
          notes: [
            { name: "Smoke", category: "Peaty", common: true, usageCount: 1 },
            { name: "Vanilla", category: "Sweet", common: true, usageCount: 1 },
          ],
          onChange: setNoseTags,
          value: noseTags,
        }}
        palate={{
          id: "review-palate",
          notes: [
            { name: "Smoke", category: "Peaty", common: true, usageCount: 1 },
            { name: "Vanilla", category: "Sweet", common: true, usageCount: 1 },
          ],
          onChange: setPalateTags,
          value: palateTags,
        }}
        finish={{
          id: "review-finish",
          notes: [
            { name: "Smoke", category: "Peaty", common: true, usageCount: 1 },
            { name: "Vanilla", category: "Sweet", common: true, usageCount: 1 },
          ],
          onChange: setFinishTags,
          value: finishTags,
        }}
      />
    );
  if (step === "pour")
    return (
      <TastingPourStep
        disabled={disabled}
        serving={{
          id: "tasting-serving",
          name: "servingStyle",
          disabled,
          value: serving,
          onChange: setServing,
        }}
        color={{
          id: "tasting-color",
          name: "color",
          disabled,
          value: color,
          onChange: setColor,
        }}
        photo={{
          id: "tasting-photo",
          name: "photo",
          disabled,
          onFilesSelected: (files) => {
            const file = files.item(0);
            if (file) setPhoto(URL.createObjectURL(file));
          },
          onRemove: () => setPhoto(undefined),
          preview: photo ? { src: photo, alt: "Attached photo" } : undefined,
        }}
        friends={{
          options: memberOptions,
          value: friends,
          onChange: setFriends,
        }}
      />
    );
  if (step === "score")
    return (
      <MemberReviewScoreStep
        id="review-score"
        name="score"
        disabled={disabled}
        required
        value={score}
        onChange={setScore}
      />
    );
  return (
    <TastingRatingStep
      id="tasting-rating"
      name="ratingBand"
      disabled={disabled}
      required
      value={rating}
      onChange={setRating}
    />
  );
}

const meta = {
  title: "Components/Forms/Tasting Form Steps",
  component: TastingStepExample,
  args: { step: "notes", disabled: false },
  argTypes: {
    step: {
      control: "select",
      options: ["choose", "notes", "review-notes", "pour", "rating", "score"],
    },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The fields used by tasting and review forms. A tasting has one Flavors field. A review has Nose, Palate, and Finish. Serving and color come next, followed by the rating or score. Photos and friends open separately.",
      },
    },
  },
} satisfies Meta<typeof TastingStepExample>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
