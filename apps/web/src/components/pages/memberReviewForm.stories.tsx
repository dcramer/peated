"use client";

import { mockBottle } from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useState } from "react";

import {
  Field,
  FormSection,
  FormStack,
  FormSteps,
  PictureInput,
  RatingBandInput,
  ReviewScoreInput,
  SelectedBottleSummary,
  Textarea,
  WorkflowScreen,
} from "@peated/web/components";
import {
  RecordTypeInput,
  type RecordType,
} from "@peated/web/components/recordTypeInput.stylex";
import type { RatingBand } from "@peated/web/components/scoring.stylex";

const meta = {
  title: "Pages/Member Review Form",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function MemberReviewFormStory() {
    const [recordType, setRecordType] = useState<RecordType>("review");
    const [rating, setRating] = useState<RatingBand | null>("very_good");
    const [score, setScore] = useState<number | null>(91);
    const [review, setReview] = useState(
      "Coastal and waxy, with a long mineral finish.",
    );
    const [imagePreview, setImagePreview] = useState<string>();

    useEffect(() => {
      return () => {
        if (imagePreview?.startsWith("blob:")) {
          URL.revokeObjectURL(imagePreview);
        }
      };
    }, [imagePreview]);

    const isReview = recordType === "review";

    return (
      <WorkflowScreen
        mobileSaveBar
        onClose={() => undefined}
        onSave={() => undefined}
        saveHint={isReview ? "Saving updates your existing review." : undefined}
        saveLabel={isReview ? "Update review" : "Continue"}
        title={isReview ? "Edit your review" : "Log a tasting"}
      >
        <form>
          <FormStack>
            <SelectedBottleSummary bottle={mockBottle} />
            <RecordTypeInput
              disabled={false}
              onChange={setRecordType}
              value={recordType}
            />
            {isReview ? (
              <>
                <FormSection title="Your score">
                  <ReviewScoreInput
                    id="review-score"
                    name="score"
                    onChange={setScore}
                    required
                    value={score}
                  />
                </FormSection>
                <FormSection
                  description="Review the bottle as a whole, not only this pour."
                  title="Your review"
                >
                  <Field htmlFor="review-notes" label="Review" optional>
                    <Textarea
                      id="review-notes"
                      onChange={(event) => setReview(event.currentTarget.value)}
                      rows={8}
                      value={review}
                    />
                  </Field>
                  <Field htmlFor="review-picture" label="Picture" optional>
                    <PictureInput
                      id="review-picture"
                      name="reviewImage"
                      onFilesSelected={(files) => {
                        const file = files.item(0);
                        if (file) setImagePreview(URL.createObjectURL(file));
                      }}
                      onRemove={
                        imagePreview
                          ? () => setImagePreview(undefined)
                          : undefined
                      }
                      preview={
                        imagePreview
                          ? { alt: "Review picture", src: imagePreview }
                          : undefined
                      }
                    />
                  </Field>
                </FormSection>
              </>
            ) : (
              <>
                <FormSteps
                  currentStep={0}
                  steps={["Rating", "Notes", "Details"]}
                />
                <FormSection title="How was it?">
                  <RatingBandInput
                    id="tasting-rating"
                    name="rating"
                    onChange={setRating}
                    required
                    value={rating}
                  />
                </FormSection>
              </>
            )}
          </FormStack>
        </form>
      </WorkflowScreen>
    );
  },
};
