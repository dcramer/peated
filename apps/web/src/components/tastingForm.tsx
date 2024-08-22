"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SERVING_STYLE_LIST } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import { TastingInputSchema } from "@peated/server/schemas";
import type {
  Paginated,
  ServingStyle,
  SuggestedTag,
  Tag,
  Tasting,
  User,
} from "@peated/server/types";
import BottleCard from "@peated/web/components/bottleCard";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import ImageField from "@peated/web/components/imageField";
import Layout from "@peated/web/components/layout";
import RangeField from "@peated/web/components/rangeField";
import type { Option } from "@peated/web/components/selectField";
import SelectField from "@peated/web/components/selectField";
import TextAreaField from "@peated/web/components/textAreaField";
import { logError } from "@peated/web/lib/log";
import { isTRPCClientError, trpc } from "@peated/web/lib/trpc/client";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import ColorField from "./colorField";
import Form from "./form";
import NoResultsFoundEntry from "./selectField/noResultsFoundEntry";
import ServingStyleIcon from "./servingStyleIcon";

type FormSchemaType = z.infer<typeof TastingInputSchema>;

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

export default function TastingForm({
  onSubmit,
  initialData,
  title,
  suggestedTags,
}: {
  onSubmit: SubmitHandler<
    FormSchemaType & {
      image: HTMLCanvasElement | null | undefined;
    }
  >;
  initialData: Partial<Tasting> & Pick<Tasting, "bottle">;
  title: string;
  suggestedTags: Paginated<SuggestedTag>;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(TastingInputSchema),
    defaultValues: {
      bottle: initialData.bottle.id,
      rating: initialData.rating,
      notes: initialData.notes,
      tags: initialData.tags,
      color: initialData.color,
      servingStyle: initialData.servingStyle,
      friends: initialData.friends ? initialData.friends.map((d) => d.id) : [],
    },
  });

  const [error, setError] = useState<string | undefined>();
  const [image, setImage] = useState<HTMLCanvasElement | null | undefined>(
    null,
  );
  const [friendsValue, setFriendsValue] = useState<Option[]>(
    initialData.friends ? initialData.friends.map(userToOption) : [],
  );

  const trpcUtils = trpc.useUtils();

  const onSubmitHandler: SubmitHandler<
    FormSchemaType & {
      image: HTMLCanvasElement | null | undefined;
    }
  > = async (data) => {
    try {
      await onSubmit({ ...data, image });
    } catch (err) {
      if (isTRPCClientError(err)) {
        setError(err.message);
      } else {
        logError(err);
        setError("Internal error");
      }
    }
  };

  type TagOption = Option & { count: number; tag: Tag };

  const tagOptions = suggestedTags.results.map((t) => ({
    id: t.tag.name,
    name: toTitleCase(t.tag.name),
    count: t.count,
    tag: t.tag,
  }));

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title={title}
            onSave={handleSubmit(onSubmitHandler)}
            saveDisabled={isSubmitting}
          />
        </Header>
      }
      footer={null}
    >
      <div className="lg:mb-8 lg:p-0">
        <BottleCard bottle={initialData.bottle} color="highlight" />
      </div>

      {error && <FormError values={[error]} />}

      <Form
        onSubmit={handleSubmit(onSubmitHandler)}
        isSubmitting={isSubmitting}
      >
        <Fieldset>
          <Controller
            name="rating"
            control={control}
            render={({ field: { ref, onChange, ...field } }) => (
              <RangeField
                {...field}
                onChange={(e) =>
                  onChange(
                    e.target.value === ""
                      ? undefined
                      : parseInt(e.target.value, 10),
                  )
                }
                error={errors.rating}
                label="Rating"
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
                      o.tag.tagCategory
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  );
                }}
                onRenderOption={(option) => {
                  return (
                    <div className="flex flex-col items-start">
                      <div>{option.name}</div>
                      <div className="text-muted font-normal">
                        {toTitleCase(option.tag.tagCategory)}
                      </div>
                    </div>
                  );
                }}
                onChange={(value) => onChange(value.map((t: any) => t.id))}
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
              <SelectField
                {...field}
                onQuery={async (query) => {
                  const { results } = await trpcUtils.friendList.fetch({
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
                  onChange(value.map((t: any) => t.id || t));
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
    </Layout>
  );
}
