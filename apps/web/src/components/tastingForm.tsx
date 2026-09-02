"use client";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { toTitleCase } from "@peated/server/lib/strings";
import type { TastingSchema } from "@peated/server/schemas";
import type { User } from "@peated/server/types";
import {
  Button,
  ColorInput,
  Field,
  FieldGroup,
  FormNotice,
  FormSection,
  FormStack,
  FormSteps,
  LoadingList,
  MemberPicker,
  NotePickerField,
  PictureInput,
  RatingBandInput,
  ReviewScoreInput,
  SelectedBottleSummary,
  ServingStyleInput,
  Textarea,
  ValidationMessage,
  type MemberPickerOption,
  type NotePickerOption,
} from "@peated/web/components";
import {
  RecordTypeInput,
  type RecordType,
} from "@peated/web/components/recordTypeInput.stylex";
import { WorkflowScreen } from "@peated/web/components/workflowScreen.stylex";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import type { ImageUploadValue } from "@peated/web/lib/imageUpload";
import {
  buildMemberReviewFormSubmission,
  MemberReviewFormFieldsSchema,
  type MemberReviewFormFields,
  type MemberReviewFormSubmitData,
} from "@peated/web/lib/memberReviewForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  buildTastingCreateFormSubmission,
  buildTastingEditFormSubmission,
  buildTastingTagOptions,
  TastingCreateFormFieldsSchema,
  TastingFormFieldsSchema,
  type TastingCreateFormSubmitData,
  type TastingEditFormSubmitData,
  type TastingFormFields,
  type TastingTagSuggestion,
} from "@peated/web/lib/tastingForm";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

export type { MemberReviewFormSubmitData } from "@peated/web/lib/memberReviewForm";
export type {
  TastingCreateFormSubmitData,
  TastingEditFormSubmitData,
} from "@peated/web/lib/tastingForm";

type TastingCreateFormProps = {
  initialData: Partial<z.infer<typeof TastingSchema>> &
    Pick<z.infer<typeof TastingSchema>, "bottle">;
  mode?: "create";
  onReviewSubmit: SubmitHandler<MemberReviewFormSubmitData>;
  onSubmit: SubmitHandler<TastingCreateFormSubmitData>;
};

type TastingEditFormProps = {
  initialData: z.infer<typeof TastingSchema>;
  mode: "edit";
  onSubmit: SubmitHandler<TastingEditFormSubmitData>;
};

export default function TastingForm(
  props: {
    errorMessage?: string;
    suggestedTags: { results: TastingTagSuggestion[] };
    title: string;
  } & (TastingCreateFormProps | TastingEditFormProps),
) {
  const { errorMessage, initialData, suggestedTags, title } = props;
  const orpc = useORPC();
  const canRecordReview = props.mode !== "edit";
  const [recordType, setRecordType] = useState<RecordType | null>(
    canRecordReview ? null : "tasting",
  );
  const isReview = recordType === "review";
  const [submitError, setSubmitError] = useState<string>();
  const [image, setImage] = useState<ImageUploadValue>();
  const [imagePreview, setImagePreview] = useState(
    initialData.imageUrl ?? undefined,
  );
  const [reviewImage, setReviewImage] = useState<ImageUploadValue>();
  const [reviewImagePreview, setReviewImagePreview] = useState(
    initialData.imageUrl ?? undefined,
  );
  const [friendQuery, setFriendQuery] = useState("");
  const [friends, setFriends] = useState<readonly MemberPickerOption[]>(
    (initialData.friends ?? []).map(userToMember),
  );
  const friendResults = useQuery(
    orpc.friends.list.queryOptions({
      input: { filter: "active", query: friendQuery },
    }),
  );
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    trigger,
  } = useForm<TastingFormFields>({
    defaultValues: {
      color: initialData.color,
      friends: initialData.friends?.map((friend) => friend.id) ?? [],
      notes: initialData.notes,
      ratingBand: initialData.ratingBand,
      servingStyle: initialData.servingStyle,
      tags: initialData.tags,
    },
    resolver: zodResolver(
      props.mode === "edit"
        ? TastingFormFieldsSchema
        : TastingCreateFormFieldsSchema,
    ),
  });
  const {
    formState: { errors: reviewErrors, isSubmitting: isReviewSubmitting },
    handleSubmit: handleReviewSubmit,
    register: registerReview,
    reset: resetReview,
    control: reviewControl,
    trigger: triggerReview,
  } = useForm<MemberReviewFormFields>({
    defaultValues: {
      score: 80,
      tags: [],
      color: null,
      notes: null,
      servingStyle: null,
      friends: [],
    },
    resolver: zodResolver(MemberReviewFormFieldsSchema),
  });
  const ratingBand = useWatch({ control, name: "ratingBand" });
  const reviewScore = useWatch({ control: reviewControl, name: "score" });
  const reviewFriendIds = useWatch({
    control: reviewControl,
    name: "friends",
  });
  const reviewQuery = useQuery({
    ...orpc.memberReviews.getMy.queryOptions({
      input: { bottle: initialData.bottle.id },
    }),
    enabled: isReview,
    staleTime: Infinity,
  });
  const reviewFriendOptions = new Map(
    [
      ...(reviewQuery.data?.friends ?? []).map(userToMember),
      ...(friendResults.data?.results ?? []).map(({ user }) =>
        userToMember(user),
      ),
    ].map((friend) => [friend.id, friend]),
  );
  const selectedReviewFriends = (reviewFriendIds ?? [])
    .map((friendId) => reviewFriendOptions.get(friendId))
    .filter((friend): friend is MemberPickerOption => Boolean(friend));
  const [currentStep, setCurrentStep] = useState(0);
  const steps = isReview
    ? (["Score", "Notes", "Details"] as const)
    : (["Rating", "Notes", "Details"] as const);
  const isLastStep = currentStep === steps.length - 1;
  const needsRating = props.mode !== "edit" && !ratingBand;
  const noteOptions: NotePickerOption[] = buildTastingTagOptions(
    suggestedTags.results,
    isReview ? (reviewQuery.data?.tags ?? []) : (initialData.tags ?? []),
  ).map((option) => ({
    category: option.tag ? toTitleCase(option.tag.tagCategory) : "Other notes",
    common: option.count > 0,
    name: option.id,
    usageCount: option.count,
  }));

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    return () => {
      if (reviewImagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(reviewImagePreview);
      }
    };
  }, [reviewImagePreview]);

  useEffect(() => {
    if (reviewQuery.data === undefined) return;
    resetReview({
      score: reviewQuery.data?.score ?? 80,
      tags: reviewQuery.data?.tags ?? [],
      color: reviewQuery.data?.color ?? null,
      notes: reviewQuery.data?.notes ?? null,
      servingStyle: reviewQuery.data?.servingStyle ?? null,
      friends: reviewQuery.data?.friends.map((friend) => friend.id) ?? [],
    });
  }, [resetReview, reviewQuery.data]);

  const effectiveReviewImagePreview =
    reviewImage === undefined
      ? (reviewQuery.data?.imageUrl ?? initialData.imageUrl ?? undefined)
      : reviewImagePreview;

  const submit: SubmitHandler<TastingFormFields> = async (fields) => {
    setSubmitError(undefined);
    try {
      if (props.mode === "edit") {
        await props.onSubmit(buildTastingEditFormSubmission({ fields, image }));
      } else {
        await props.onSubmit(
          buildTastingCreateFormSubmission({
            bottleId: props.initialData.bottle.id,
            fields,
            image,
          }),
        );
      }
    } catch (error) {
      setSubmitError(
        getFormErrorMessage(error, {
          expectedErrorNames: ["BAD_REQUEST", "CONFLICT"],
          fallbackMessage:
            "We couldn't save that tasting. Your notes are still here — try again.",
        }),
      );
    }
  };

  const submitReview: SubmitHandler<MemberReviewFormFields> = async (
    fields,
  ) => {
    if (props.mode === "edit") return;

    setSubmitError(undefined);
    try {
      await props.onReviewSubmit(
        buildMemberReviewFormSubmission({
          bottleId: props.initialData.bottle.id,
          fields,
          image: reviewImage,
        }),
      );
    } catch (error) {
      setSubmitError(
        getFormErrorMessage(error, {
          expectedErrorNames: ["BAD_REQUEST", "CONFLICT"],
          fallbackMessage:
            "We couldn't save that review. Your review is still here — try again.",
        }),
      );
    }
  };

  async function continueForm() {
    const stepIsValid = isReview
      ? await triggerReview(
          currentStep === 0
            ? ["score"]
            : currentStep === 1
              ? ["tags", "color", "notes"]
              : ["servingStyle", "friends"],
        )
      : await trigger(
          currentStep === 0
            ? ["ratingBand"]
            : currentStep === 1
              ? ["tags", "color", "notes"]
              : ["servingStyle", "friends"],
        );
    if (!stepIsValid) return;
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
    scrollToFormTop();
  }

  const tastingFormAction = isLastStep
    ? handleSubmit(submit)
    : (event: React.FormEvent) => {
        event.preventDefault();
        void continueForm();
      };
  const reviewFormAction = isLastStep
    ? handleReviewSubmit(submitReview)
    : (event: React.FormEvent) => {
        event.preventDefault();
        void continueForm();
      };
  const formAction = isReview ? reviewFormAction : tastingFormAction;
  const saving = isReview ? isReviewSubmitting : isSubmitting;
  const reviewIsLoading = isReview && reviewQuery.isPending;
  const reviewLoadFailed = isReview && Boolean(reviewQuery.error);
  const saveDisabled = isReview
    ? reviewIsLoading || reviewLoadFailed || reviewScore === null
    : needsRating;
  const saveHint = isReview
    ? reviewIsLoading
      ? "Loading your review…"
      : reviewLoadFailed
        ? "Your review could not be loaded."
        : reviewScore === null
          ? "Enter a score to save."
          : undefined
    : needsRating
      ? "Pick a rating to continue."
      : undefined;
  const saveLabel = isReview
    ? isLastStep
      ? reviewQuery.data
        ? "Update review"
        : "Save review"
      : "Continue"
    : isLastStep
      ? "Save tasting"
      : "Continue";

  function selectRecordType(nextType: RecordType) {
    setSubmitError(undefined);
    setCurrentStep(0);
    setRecordType(nextType);
    scrollToFormTop();
  }

  function previousStep() {
    if (currentStep > 0) {
      setCurrentStep((step) => Math.max(0, step - 1));
      scrollToFormTop();
      return;
    }
    if (canRecordReview) {
      setRecordType(null);
      scrollToFormTop();
    }
  }

  function scrollToFormTop() {
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }

  return (
    <WorkflowScreen
      mobileSaveBar
      onPrevious={
        recordType && (currentStep > 0 || canRecordReview)
          ? previousStep
          : undefined
      }
      onSave={recordType ? formAction : undefined}
      saveDisabled={saveDisabled}
      saveHint={saveHint}
      saveLabel={saveLabel}
      saving={saving}
      title={
        isReview
          ? reviewQuery.data
            ? "Edit your review"
            : "Write a review"
          : title
      }
    >
      <form onSubmit={formAction}>
        <FormStack>
          <SelectedBottleSummary
            brand={
              initialData.bottle.brand.shortName ||
              initialData.bottle.brand.name
            }
            imageUrl={
              (isReview ? effectiveReviewImagePreview : imagePreview) ??
              initialData.bottle.imageUrl
            }
            metadata={getBottleMetadata(initialData.bottle)}
            name={formatBottleDisplayName(initialData.bottle, {
              includeBrand: false,
            })}
          />
          {submitError || errorMessage ? (
            <FormNotice>{submitError ?? errorMessage}</FormNotice>
          ) : null}
          {recordType === null ? (
            <FormSection
              description="A tasting records one pour. A review is your overall opinion of the bottle."
              title="What do you want to log?"
            >
              <RecordTypeInput
                disabled={saving}
                onChange={selectRecordType}
                value={recordType}
              />
            </FormSection>
          ) : null}
          {recordType !== null ? (
            <FormSteps currentStep={currentStep} steps={steps} />
          ) : null}
          {isReview && reviewIsLoading ? (
            <LoadingList label="Loading your review" rows={2} />
          ) : null}
          {isReview && reviewLoadFailed ? (
            <>
              <FormNotice role="alert">
                We couldn't load your review. Try again or go back and choose a
                tasting.
              </FormNotice>
              <Button
                onClick={() => void reviewQuery.refetch()}
                size="sm"
                type="button"
                variant="tonal"
              >
                Try again
              </Button>
            </>
          ) : null}
          {isReview && !reviewIsLoading && !reviewLoadFailed ? (
            currentStep === 0 ? (
              <FormSection title="Your score">
                <Controller
                  control={reviewControl}
                  name="score"
                  render={({ field }) => (
                    <ReviewScoreInput
                      disabled={isReviewSubmitting}
                      id="review-score"
                      invalid={Boolean(reviewErrors.score)}
                      name={field.name}
                      onChange={field.onChange}
                      required
                      value={field.value}
                    />
                  )}
                />
                {reviewErrors.score?.message ? (
                  <ValidationMessage>
                    {reviewErrors.score.message}
                  </ValidationMessage>
                ) : null}
              </FormSection>
            ) : currentStep === 1 ? (
              <FormSection title="What you tasted">
                <Field
                  hint="Suggested from this bottle's own tastings."
                  htmlFor="review-notes"
                  label="Notes"
                  optional
                >
                  <Controller
                    control={reviewControl}
                    name="tags"
                    render={({ field }) => (
                      <NotePickerField
                        id="review-notes"
                        notes={noteOptions}
                        onChange={field.onChange}
                        value={field.value ?? []}
                      />
                    )}
                  />
                  {reviewErrors.tags?.message ? (
                    <ValidationMessage>
                      {reviewErrors.tags.message}
                    </ValidationMessage>
                  ) : null}
                </Field>
                <Field htmlFor="review-color" label="Color" optional>
                  <Controller
                    control={reviewControl}
                    name="color"
                    render={({ field }) => (
                      <ColorInput
                        disabled={isReviewSubmitting}
                        id="review-color"
                        name={field.name}
                        onChange={field.onChange}
                        value={field.value ?? null}
                      />
                    )}
                  />
                  {reviewErrors.color?.message ? (
                    <ValidationMessage>
                      {reviewErrors.color.message}
                    </ValidationMessage>
                  ) : null}
                </Field>
                <Field
                  error={reviewErrors.notes?.message}
                  htmlFor="review-comments"
                  label="Comment"
                  optional
                >
                  <Textarea
                    {...registerReview("notes", {
                      setValueAs: (value) => value || null,
                    })}
                    aria-label="Comments"
                    id="review-comments"
                    invalid={Boolean(reviewErrors.notes)}
                    placeholder="What do you want to remember about this pour?"
                    rows={6}
                  />
                </Field>
              </FormSection>
            ) : (
              <FormSection title="The sitting">
                <FieldGroup
                  error={reviewErrors.servingStyle?.message}
                  hint="How you took it, not how the bottle ships."
                  label="Serving"
                  optional
                >
                  <Controller
                    control={reviewControl}
                    name="servingStyle"
                    render={({ field }) => (
                      <ServingStyleInput
                        disabled={isReviewSubmitting}
                        id="review-serving-style"
                        name={field.name}
                        onChange={field.onChange}
                        value={field.value ?? null}
                      />
                    )}
                  />
                </FieldGroup>
                <Field htmlFor="review-picture" label="Picture" optional>
                  <PictureInput
                    disabled={isReviewSubmitting}
                    id="review-picture"
                    name="reviewImage"
                    onFilesSelected={(files) => {
                      const file = files.item(0);
                      if (!file) return;
                      setReviewImage(file);
                      setReviewImagePreview(URL.createObjectURL(file));
                    }}
                    onRemove={
                      effectiveReviewImagePreview
                        ? () => {
                            setReviewImage(null);
                            setReviewImagePreview(undefined);
                          }
                        : undefined
                    }
                    preview={
                      effectiveReviewImagePreview
                        ? {
                            alt: "Review picture",
                            src: effectiveReviewImagePreview,
                          }
                        : undefined
                    }
                  />
                </Field>
                <Controller
                  control={reviewControl}
                  name="friends"
                  render={({ field }) => (
                    <MemberPicker
                      label="Friends"
                      loading={friendResults.isFetching}
                      onChange={(nextFriends) => {
                        field.onChange(nextFriends.map((friend) => friend.id));
                      }}
                      onQueryChange={setFriendQuery}
                      options={(friendResults.data?.results ?? []).map(
                        ({ user }) => userToMember(user),
                      )}
                      value={selectedReviewFriends}
                    />
                  )}
                />
              </FormSection>
            )
          ) : null}
          {recordType === "tasting" && currentStep === 0 ? (
            <FormSection title="How was it?">
              <Controller
                control={control}
                name="ratingBand"
                render={({ field }) => (
                  <RatingBandInput
                    disabled={isSubmitting}
                    id="tasting-rating"
                    name={field.name}
                    onChange={field.onChange}
                    required={props.mode !== "edit"}
                    value={field.value ?? null}
                  />
                )}
              />
              {errors.ratingBand?.message ? (
                <ValidationMessage>
                  {errors.ratingBand.message}
                </ValidationMessage>
              ) : null}
            </FormSection>
          ) : null}
          {recordType === "tasting" && currentStep === 1 ? (
            <FormSection title="What you tasted">
              <Field
                hint="Suggested from this bottle's own tastings."
                htmlFor="tasting-notes"
                label="Notes"
                optional
              >
                <Controller
                  control={control}
                  name="tags"
                  render={({ field }) => (
                    <NotePickerField
                      id="tasting-notes"
                      notes={noteOptions}
                      onChange={field.onChange}
                      value={field.value ?? []}
                    />
                  )}
                />
                {errors.tags?.message ? (
                  <ValidationMessage>{errors.tags.message}</ValidationMessage>
                ) : null}
              </Field>
              <Field htmlFor="tasting-color" label="Color" optional>
                <Controller
                  control={control}
                  name="color"
                  render={({ field }) => (
                    <ColorInput
                      disabled={isSubmitting}
                      id="tasting-color"
                      name={field.name}
                      onChange={field.onChange}
                      value={field.value ?? null}
                    />
                  )}
                />
                {errors.color?.message ? (
                  <ValidationMessage>{errors.color.message}</ValidationMessage>
                ) : null}
              </Field>
              <Field
                error={errors.notes?.message}
                htmlFor="tasting-comments"
                label="Comment"
                optional
              >
                <Textarea
                  {...register("notes", {
                    setValueAs: (value) => value || null,
                  })}
                  aria-label="Comments"
                  id="tasting-comments"
                  invalid={Boolean(errors.notes)}
                  placeholder="What do you want to remember about this pour?"
                  rows={6}
                />
              </Field>
            </FormSection>
          ) : null}
          {recordType === "tasting" && currentStep === 2 ? (
            <FormSection title="The sitting">
              <FieldGroup
                error={errors.servingStyle?.message}
                hint="How you took it, not how the bottle ships."
                label="Serving"
                optional
              >
                <Controller
                  control={control}
                  name="servingStyle"
                  render={({ field }) => (
                    <ServingStyleInput
                      disabled={isSubmitting}
                      id="tasting-serving-style"
                      name={field.name}
                      onChange={field.onChange}
                      value={field.value ?? null}
                    />
                  )}
                />
              </FieldGroup>
              <Field htmlFor="tasting-picture" label="Picture" optional>
                <PictureInput
                  disabled={isSubmitting}
                  id="tasting-picture"
                  name="image"
                  onFilesSelected={(files) => {
                    const file = files.item(0);
                    if (!file) return;
                    setImage(file);
                    setImagePreview(URL.createObjectURL(file));
                  }}
                  onRemove={
                    imagePreview
                      ? () => {
                          setImage(null);
                          setImagePreview(undefined);
                        }
                      : undefined
                  }
                  preview={
                    imagePreview
                      ? { alt: "Tasting picture", src: imagePreview }
                      : undefined
                  }
                />
              </Field>
              <Controller
                control={control}
                name="friends"
                render={({ field }) => (
                  <MemberPicker
                    label="Friends"
                    loading={friendResults.isFetching}
                    onChange={(nextFriends) => {
                      setFriends(nextFriends);
                      field.onChange(nextFriends.map((friend) => friend.id));
                    }}
                    onQueryChange={setFriendQuery}
                    options={(friendResults.data?.results ?? []).map(
                      ({ user }) => userToMember(user),
                    )}
                    value={friends}
                  />
                )}
              />
            </FormSection>
          ) : null}
        </FormStack>
      </form>
    </WorkflowScreen>
  );
}

function userToMember(user: User): MemberPickerOption {
  return { id: user.id, username: user.username };
}
