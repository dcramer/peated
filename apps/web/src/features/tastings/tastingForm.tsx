"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import type { TastingSchema } from "@peated/server/schemas";
import type { User } from "@peated/server/types";
import {
  Button,
  FormNotice,
  FormSection,
  FormStack,
  FormSteps,
  LoadingList,
  SelectedBottleSummary,
  type MemberPickerOption,
  type NotePickerOption,
} from "@peated/web/components";
import {
  TastingFormModeChoice,
  type TastingFormMode,
} from "@peated/web/components/tastingFormModeChoice.stylex";
import {
  MemberReviewScoreStep,
  TastingNotesStep,
  TastingPourStep,
  TastingRatingStep,
} from "@peated/web/components/tastingFormSteps.stylex";
import { WorkflowScreen } from "@peated/web/components/workflowScreen.stylex";
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
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

export type { MemberReviewFormSubmitData } from "@peated/web/lib/memberReviewForm";
export type {
  TastingCreateFormSubmitData,
  TastingEditFormSubmitData,
} from "@peated/web/lib/tastingForm";

function TastingFormModeSection({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (value: TastingFormMode) => void;
}) {
  return (
    <FormSection title="What would you like to add?">
      <TastingFormModeChoice disabled={disabled} onChange={onChange} />
    </FormSection>
  );
}

/** Reserves the first-step tasting form while its bottle data loads. */
export function TastingFormLoading({ title }: { title: string }) {
  return (
    <WorkflowScreen mobileSaveBar title={title}>
      <FormStack>
        <LoadingList label="Loading bottle" rows={1} />
        <TastingFormModeSection disabled onChange={() => undefined} />
      </FormStack>
    </WorkflowScreen>
  );
}

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
  const canChooseMode = props.mode !== "edit";
  const [formMode, setFormMode] = useState<TastingFormMode | null>(
    canChooseMode ? null : "tasting",
  );
  const isReview = formMode === "review";
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
    setValue,
    trigger,
  } = useForm<TastingFormFields>({
    defaultValues: {
      color: initialData.color ?? null,
      friends: initialData.friends?.map((friend) => friend.id) ?? [],
      notes: initialData.notes ?? null,
      ratingBand: initialData.ratingBand ?? null,
      servingStyle: initialData.servingStyle ?? null,
      tags: initialData.tags ?? [],
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
    setValue: setReviewValue,
    control: reviewControl,
    trigger: triggerReview,
  } = useForm<MemberReviewFormFields>({
    defaultValues: {
      score: null,
      tags: [],
      color: null,
      notes: null,
      servingStyle: null,
      friends: [],
    },
    resolver: zodResolver(MemberReviewFormFieldsSchema),
  });
  const tastingValues = useWatch({ control });
  const reviewValues = useWatch({ control: reviewControl });
  const [reviewFriends, setReviewFriends] = useState<
    readonly MemberPickerOption[] | null
  >(null);
  const reviewQuery = useQuery({
    ...orpc.memberReviews.getMy.queryOptions({
      input: { bottle: initialData.bottle.id },
    }),
    enabled: isReview,
    staleTime: Infinity,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const steps = isReview
    ? (["Notes", "The pour", "Score"] as const)
    : (["Notes", "The pour", "Rating"] as const);
  const isLastStep = currentStep === steps.length - 1;
  const needsRating = props.mode !== "edit" && !tastingValues.ratingBand;
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
      score: reviewQuery.data?.score ?? null,
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

  const photoPreview = isReview ? effectiveReviewImagePreview : imagePreview;

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
    const fields =
      currentStep === 0
        ? (["notes", "tags"] as const)
        : (["servingStyle", "color", "friends"] as const);
    const stepIsValid = isReview
      ? await triggerReview([...fields])
      : await trigger([...fields]);
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
  const validReviewScore =
    reviewValues.score != null &&
    Number.isInteger(reviewValues.score) &&
    reviewValues.score >= 0 &&
    reviewValues.score <= 100;
  const saveDisabled =
    reviewIsLoading ||
    reviewLoadFailed ||
    (isLastStep && (isReview ? !validReviewScore : needsRating));
  const saveHint =
    isLastStep && isReview && !validReviewScore
      ? "Enter a score from 0 to 100."
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

  function selectFormMode(nextMode: TastingFormMode) {
    setSubmitError(undefined);
    setCurrentStep(0);
    setFormMode(nextMode);
    scrollToFormTop();
  }

  function previousStep() {
    if (currentStep > 0) {
      setCurrentStep((step) => Math.max(0, step - 1));
      scrollToFormTop();
      return;
    }
    if (canChooseMode) {
      setFormMode(null);
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
        formMode && (currentStep > 0 || canChooseMode)
          ? previousStep
          : undefined
      }
      onSave={formMode ? formAction : undefined}
      saveDisabled={saveDisabled}
      saveHint={saveHint}
      saveLabel={saveLabel}
      saving={saving}
      title={
        isReview
          ? reviewQuery.data
            ? "Edit your review"
            : "Write a review"
          : formMode === "tasting"
            ? props.mode === "edit"
              ? title
              : "Log a tasting"
            : "Rate this bottle"
      }
    >
      <form onSubmit={formAction}>
        <FormStack>
          <SelectedBottleSummary
            bottle={initialData.bottle}
            imageUrl={photoPreview ?? initialData.bottle.imageUrl}
          />
          {submitError || errorMessage ? (
            <FormNotice>{submitError ?? errorMessage}</FormNotice>
          ) : null}
          {formMode === null ? (
            <TastingFormModeSection
              disabled={saving}
              onChange={selectFormMode}
            />
          ) : null}
          {formMode !== null ? (
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
          {formMode && !reviewIsLoading && !reviewLoadFailed ? (
            currentStep === 0 ? (
              <TastingNotesStep
                label={isReview ? "What do you think?" : "What stood out?"}
                notes={{
                  ...(isReview
                    ? registerReview("notes", {
                        setValueAs: (value) => value || null,
                      })
                    : register("notes", {
                        setValueAs: (value) => value || null,
                      })),
                  id: `${formMode}-comments`,
                  disabled: saving,
                }}
                notesError={(isReview ? reviewErrors : errors).notes?.message}
                flavors={{
                  id: `${formMode}-flavors`,
                  notes: noteOptions,
                  value: (isReview ? reviewValues : tastingValues).tags ?? [],
                  onChange: (tags) =>
                    isReview
                      ? setReviewValue("tags", [...tags], { shouldDirty: true })
                      : setValue("tags", [...tags], { shouldDirty: true }),
                }}
                flavorsError={(isReview ? reviewErrors : errors).tags?.message}
              />
            ) : currentStep === 1 ? (
              <TastingPourStep
                disabled={saving}
                serving={{
                  disabled: saving,
                  id: `${formMode}-serving-style`,
                  name: "servingStyle",
                  value:
                    (isReview ? reviewValues : tastingValues).servingStyle ??
                    null,
                  onChange: (value) =>
                    isReview
                      ? setReviewValue("servingStyle", value, {
                          shouldDirty: true,
                        })
                      : setValue("servingStyle", value, { shouldDirty: true }),
                }}
                servingError={
                  (isReview ? reviewErrors : errors).servingStyle?.message
                }
                color={{
                  disabled: saving,
                  id: `${formMode}-color`,
                  name: "color",
                  value:
                    (isReview ? reviewValues : tastingValues).color ?? null,
                  onChange: (value) =>
                    isReview
                      ? setReviewValue("color", value, { shouldDirty: true })
                      : setValue("color", value, { shouldDirty: true }),
                }}
                colorError={(isReview ? reviewErrors : errors).color?.message}
                photo={{
                  disabled: saving,
                  id: `${formMode}-picture`,
                  name: "image",
                  onFilesSelected: (files) => {
                    const file = files.item(0);
                    if (!file) return;
                    if (isReview) {
                      setReviewImage(file);
                      setReviewImagePreview(URL.createObjectURL(file));
                    } else {
                      setImage(file);
                      setImagePreview(URL.createObjectURL(file));
                    }
                  },
                  onRemove: photoPreview
                    ? () => {
                        if (isReview) {
                          setReviewImage(null);
                          setReviewImagePreview(undefined);
                        } else {
                          setImage(null);
                          setImagePreview(undefined);
                        }
                      }
                    : undefined,
                  preview: photoPreview
                    ? {
                        alt: "Attached photo",
                        src: photoPreview,
                      }
                    : undefined,
                }}
                friends={{
                  loading: friendResults.isFetching,
                  onQueryChange: setFriendQuery,
                  options: (friendResults.data?.results ?? []).map(({ user }) =>
                    userToMember(user),
                  ),
                  value: isReview
                    ? (reviewFriends ??
                      (reviewQuery.data?.friends ?? []).map(userToMember))
                    : friends,
                  onChange: (nextFriends) => {
                    const ids = nextFriends.map((friend) => friend.id);
                    if (isReview) {
                      setReviewFriends(nextFriends);
                      setReviewValue("friends", ids, { shouldDirty: true });
                    } else {
                      setFriends(nextFriends);
                      setValue("friends", ids, { shouldDirty: true });
                    }
                  },
                }}
                friendsError={
                  (isReview ? reviewErrors : errors).friends?.message
                }
              />
            ) : isReview ? (
              <MemberReviewScoreStep
                disabled={saving}
                error={reviewErrors.score?.message}
                id="review-score"
                name="score"
                onChange={(score) =>
                  setReviewValue("score", score, { shouldDirty: true })
                }
                required
                value={reviewValues.score ?? null}
              />
            ) : (
              <TastingRatingStep
                disabled={saving}
                error={errors.ratingBand?.message}
                id="tasting-rating"
                name="ratingBand"
                onChange={(ratingBand) =>
                  setValue("ratingBand", ratingBand, { shouldDirty: true })
                }
                required={props.mode !== "edit"}
                value={tastingValues.ratingBand ?? null}
              />
            )
          ) : null}
        </FormStack>
      </form>
    </WorkflowScreen>
  );
}

function userToMember(user: User): MemberPickerOption {
  return { id: user.id, username: user.username };
}
