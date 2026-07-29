"use client";

import { SERVING_STYLE_LIST } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import type { TastingSchema } from "@peated/server/schemas";
import type { ServingStyle, User } from "@peated/server/types";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormScreen from "@peated/web/components/formScreen";
import ImageField from "@peated/web/components/imageField";
import type { Option } from "@peated/web/components/selectField";
import SelectField from "@peated/web/components/selectField";
import SimpleRatingInput from "@peated/web/components/simpleRatingInput";
import TextAreaField from "@peated/web/components/textAreaField";
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
  type TastingTagOptionData,
  type TastingTagSuggestion,
} from "@peated/web/lib/tastingForm";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import ColorField from "./colorField";
import Form from "./form";
import NoResultsFoundEntry from "./selectField/noResultsFoundEntry";
import ServingStyleIcon from "./servingStyleIcon";
import TastingBottleIdentity from "./tastingBottleIdentity";

export type {
  TastingCreateFormSubmitData,
  TastingEditFormSubmitData,
} from "@peated/web/lib/tastingForm";

type TastingCreateFormProps = {
  mode?: "create";
  onSubmit: SubmitHandler<TastingCreateFormSubmitData>;
  initialData: Partial<z.infer<typeof TastingSchema>> &
    Pick<z.infer<typeof TastingSchema>, "bottle">;
};

type TastingEditFormProps = {
  mode: "edit";
  onSubmit: SubmitHandler<TastingEditFormSubmitData>;
  initialData: z.infer<typeof TastingSchema>;
};

function formatServingStyle(style: ServingStyle) {
  return toTitleCase(style);
}

const servingStyleList = SERVING_STYLE_LIST.map((c) => ({
  id: c,
  name: formatServingStyle(c),
}));

const userToOption = (user: User): Option => {
  return {
    id: user.id,
    name: user.username,
  };
};

export default function TastingForm(
  props: {
    errorMessage?: string;
    title: string;
    suggestedTags: { results: TastingTagSuggestion[] };
  } & (TastingCreateFormProps | TastingEditFormProps),
) {
  const { errorMessage, title, suggestedTags } = props;
  const initialData = props.initialData;
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TastingFormFields>({
    resolver: zodResolver(TastingFormFieldsSchema),
    defaultValues: {
      rating: initialData.rating,
      notes: initialData.notes,
      tags: initialData.tags,
      color: initialData.color,
      servingStyle: initialData.servingStyle,
      friends: initialData.friends ? initialData.friends.map((d) => d.id) : [],
    },
  });

  const [error, setError] = useState<string | undefined>();
  const [image, setImage] = useState<TastingFormImage>();
  const [friendsValue, setFriendsValue] = useState<Option[]>(
    initialData.friends ? initialData.friends.map(userToOption) : [],
  );
  const orpc = useORPC();
  const onSubmitHandler: SubmitHandler<TastingFormFields> = async (data) => {
    try {
      if (props.mode === "edit") {
        await props.onSubmit(
          buildTastingEditFormSubmission({ fields: data, image }),
        );
      } else {
        await props.onSubmit(
          buildTastingCreateFormSubmission({
            fields: data,
            image,
            bottleId: props.initialData.bottle.id,
          }),
        );
      }
    } catch (err) {
      setError(
        getFormErrorMessage(err, {
          expectedErrorNames: ["BAD_REQUEST", "CONFLICT"],
        }),
      );
    }
  };

  type TagOption = Option & TastingTagOptionData;

  const tagOptions: TagOption[] = buildTastingTagOptions(
    suggestedTags.results,
    initialData.tags ?? [],
  ).map((option) => ({ ...option, name: toTitleCase(option.id) }));

  return (
    <FormScreen
      title={title}
      onSave={handleSubmit(onSubmitHandler)}
      saveDisabled={isSubmitting}
    >
      <div className="lg:mb-8 lg:p-0">
        <TastingBottleIdentity bottle={props.initialData.bottle} />
      </div>

      {(error || errorMessage) && (
        <FormError values={[error, errorMessage].filter(Boolean)} />
      )}

      <Form
        onSubmit={handleSubmit(onSubmitHandler)}
        isSubmitting={isSubmitting}
      >
        <Fieldset>
          <Controller
            name="rating"
            control={control}
            render={({ field: { onChange, ...field } }) => (
              <SimpleRatingInput
                {...field}
                onChange={onChange}
                error={errors.rating}
                label="How was it?"
              />
            )}
          />

          <Controller
            name="tags"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField<TagOption>
                {...field}
                error={errors.tags}
                label="Notes"
                targetOptions={5}
                placeholder="What flavors and aromas come to mind with this spirit?"
                options={tagOptions}
                onQuery={async (query, options) => {
                  return options.filter(
                    (o) =>
                      o.name.toLowerCase().includes(query.toLowerCase()) ||
                      o.tag?.tagCategory
                        .toLowerCase()
                        .includes(query.toLowerCase()) === true,
                  );
                }}
                onRenderOption={(option) => {
                  return (
                    <div className="flex flex-col items-start">
                      <div>{option.name}</div>
                      {option.tag && (
                        <div className="text-muted font-normal">
                          {toTitleCase(option.tag.tagCategory)}
                        </div>
                      )}
                    </div>
                  );
                }}
                onChange={(value) => onChange(value.map((tag) => tag.id))}
                value={
                  value ? tagOptions.filter((o) => value?.includes(o.id)) : []
                }
                multiple
              />
            )}
          />

          <Controller
            name="color"
            control={control}
            render={({ field: { ref, onChange, ...field } }) => (
              <ColorField
                {...field}
                onChange={(value) => onChange(value)}
                error={errors.color}
                label="Color"
              />
            )}
          />

          <TextAreaField
            {...register("notes")}
            error={errors.notes}
            rows={6}
            label="Comments"
            placeholder="Tell us how you really feel."
          />

          <ImageField
            name="image"
            label="Picture"
            value={initialData.imageUrl}
            onChange={(value) => setImage(value)}
            imageWidth={1024 / 2}
            imageHeight={768 / 2}
          />

          <Controller
            name="servingStyle"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                error={errors.servingStyle}
                label="Serving Style"
                noSort
                noDialog
                targetOptions={servingStyleList.length}
                options={servingStyleList}
                onRenderChip={(option) => {
                  if (!option.id) return option.name;
                  return (
                    <ServingStyleIcon
                      size={8}
                      servingStyle={option.id as ServingStyle}
                      className="m-2"
                    />
                  );
                }}
                onChange={(value) => onChange(value?.id)}
                value={
                  value
                    ? {
                        id: value,
                        name: formatServingStyle(value),
                      }
                    : undefined
                }
              />
            )}
          />

          <Controller
            name="friends"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField<Option>
                {...field}
                onQuery={async (query) => {
                  const { results } = await orpc.friends.list.call({
                    query,
                    filter: "active",
                  });
                  return results.map((d) => ({
                    id: d.user.id,
                    name: d.user.username,
                  }));
                }}
                multiple
                error={errors.friends}
                label="Friends"
                helpText="The people you're enjoying this tasting with."
                placeholder="e.g. Bob Dylan"
                onChange={(value) => {
                  onChange(value.map((friend) => friend.id));
                  setFriendsValue(value);
                }}
                emptyListItem={(query) => {
                  return (
                    <NoResultsFoundEntry
                      message={
                        query
                          ? "We couldn't find anyone matching your query."
                          : "It looks like you don't have any friends yet."
                      }
                    />
                  );
                }}
                value={friendsValue}
              />
            )}
          />
        </Fieldset>
      </Form>
    </FormScreen>
  );
}
