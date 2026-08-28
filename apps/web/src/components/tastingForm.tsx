"use client";

import { SERVING_STYLE_LIST } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import type { TastingSchema } from "@peated/server/schemas";
import type { User } from "@peated/server/types";
import {
  ColourInput,
  Field,
  FieldGroup,
  FormNotice,
  FormSection,
  FormStack,
  MemberPicker,
  NotePickerField,
  PictureInput,
  RatingBandInput,
  Select,
  SelectedBottleSummary,
  Textarea,
  type MemberPickerOption,
  type NotePickerOption,
} from "@peated/web/components/designSystem/components";
import { WorkflowScreen } from "@peated/web/components/designSystem/patterns/workflowScreen.stylex";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  buildTastingCreateFormSubmission,
  buildTastingEditFormSubmission,
  buildTastingTagOptions,
  TastingFormFieldsSchema,
  type TastingCreateFormSubmitData,
  type TastingEditFormSubmitData,
  type TastingFormFields,
  type TastingFormImage,
  type TastingTagSuggestion,
} from "@peated/web/lib/tastingForm";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

export type {
  TastingCreateFormSubmitData,
  TastingEditFormSubmitData,
} from "@peated/web/lib/tastingForm";

type TastingCreateFormProps = {
  initialData: Partial<z.infer<typeof TastingSchema>> &
    Pick<z.infer<typeof TastingSchema>, "bottle">;
  mode?: "create";
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
  const [submitError, setSubmitError] = useState<string>();
  const [image, setImage] = useState<TastingFormImage>();
  const [imagePreview, setImagePreview] = useState(
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
  } = useForm<TastingFormFields>({
    defaultValues: {
      color: initialData.color,
      friends: initialData.friends?.map((friend) => friend.id) ?? [],
      notes: initialData.notes,
      ratingBand: initialData.ratingBand,
      servingStyle: initialData.servingStyle,
      tags: initialData.tags,
    },
    resolver: zodResolver(TastingFormFieldsSchema),
  });
  const noteOptions: NotePickerOption[] = buildTastingTagOptions(
    suggestedTags.results,
    initialData.tags ?? [],
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
        }),
      );
    }
  };

  return (
    <WorkflowScreen
      onSave={handleSubmit(submit)}
      saveLabel="Save tasting"
      saving={isSubmitting}
      title={title}
    >
      <form onSubmit={handleSubmit(submit)}>
        <FormStack>
          <SelectedBottleSummary
            bottleId={initialData.bottle.peatedId}
            imageUrl={initialData.bottle.imageUrl}
            metadata={getBottleMetadata(initialData.bottle)}
            name={initialData.bottle.fullName}
          />
          {submitError || errorMessage ? (
            <FormNotice>{submitError ?? errorMessage}</FormNotice>
          ) : null}
          <FormSection title="Rating">
            <Controller
              control={control}
              name="ratingBand"
              render={({ field }) => (
                <RatingBandInput
                  disabled={isSubmitting}
                  id="tasting-rating"
                  label="How was it"
                  name={field.name}
                  onChange={field.onChange}
                  value={field.value ?? null}
                />
              )}
            />
          </FormSection>
          <FormSection title="Tasting notes">
            <Controller
              control={control}
              name="tags"
              render={({ field }) => (
                <FieldGroup
                  error={errors.tags?.message}
                  label="Flavours and aromas"
                  optional
                >
                  <NotePickerField
                    notes={noteOptions}
                    onChange={field.onChange}
                    value={field.value ?? []}
                  />
                </FieldGroup>
              )}
            />
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <FieldGroup
                  error={errors.color?.message}
                  label="Colour"
                  optional
                >
                  <ColourInput
                    disabled={isSubmitting}
                    id="tasting-colour"
                    name={field.name}
                    onChange={field.onChange}
                    value={field.value ?? null}
                  />
                </FieldGroup>
              )}
            />
            <Field
              error={errors.notes?.message}
              hint="Describe the aroma, taste, texture, and finish in your own words."
              htmlFor="tasting-comments"
              label="Comments"
              optional
            >
              <Textarea
                {...register("notes", {
                  setValueAs: (value) => value || null,
                })}
                id="tasting-comments"
                invalid={Boolean(errors.notes)}
                placeholder="Tell us how it drank."
                rows={6}
              />
            </Field>
          </FormSection>
          <FormSection title="Context">
            <Field
              error={errors.servingStyle?.message}
              htmlFor="tasting-serving-style"
              label="Served"
              optional
            >
              <Select
                {...register("servingStyle", {
                  setValueAs: (value) => value || null,
                })}
                id="tasting-serving-style"
                invalid={Boolean(errors.servingStyle)}
              >
                <option value="">Not set</option>
                {SERVING_STYLE_LIST.map((style) => (
                  <option key={style} value={style}>
                    {toTitleCase(style)}
                  </option>
                ))}
              </Select>
            </Field>
            <Controller
              control={control}
              name="friends"
              render={({ field }) => (
                <MemberPicker
                  loading={friendResults.isFetching}
                  onChange={(nextFriends) => {
                    setFriends(nextFriends);
                    field.onChange(nextFriends.map((friend) => friend.id));
                  }}
                  onQueryChange={setFriendQuery}
                  options={(friendResults.data?.results ?? []).map(({ user }) =>
                    userToMember(user),
                  )}
                  value={friends}
                />
              )}
            />
            <FieldGroup label="Picture" optional>
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
            </FieldGroup>
          </FormSection>
        </FormStack>
      </form>
    </WorkflowScreen>
  );
}

function userToMember(user: User): MemberPickerOption {
  return { id: user.id, username: user.username };
}
