import { zodResolver } from "@hookform/resolvers/zod";
import { SERVING_STYLE_LIST } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import { TastingInputSchema } from "@peated/server/schemas";
import type {
  Paginated,
  ServingStyle,
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
import Spinner from "@peated/web/components/spinner";
import TextAreaField from "@peated/web/components/textAreaField";
import { logError } from "@peated/web/lib/log";
import { TRPCClientError } from "@trpc/client";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { trpc } from "../lib/trpc";
import Form from "./form";

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
      picture: HTMLCanvasElement | null;
    }
  >;
  initialData: Partial<Tasting> & Pick<Tasting, "bottle">;
  title: string;
  suggestedTags: Paginated<Tag>;
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
      servingStyle: initialData.servingStyle,
      friends: initialData.friends ? initialData.friends.map((d) => d.id) : [],
    },
  });

  const [error, setError] = useState<string | undefined>();
  const [picture, setPicture] = useState<HTMLCanvasElement | null>(null);
  const [friendsValue, setFriendsValue] = useState<Option[]>(
    initialData.friends ? initialData.friends.map(userToOption) : [],
  );

  const trpcUtils = trpc.useUtils();

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      await onSubmit({ ...data, picture });
    } catch (err) {
      if (err instanceof TRPCClientError) {
        setError(err.message);
      } else {
        logError(err);
        setError("Internal error");
      }
    }
  };

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
      {isSubmitting && (
        <div className="fixed inset-0 z-10">
          <div className="absolute inset-0 bg-slate-800 opacity-50" />
          <Spinner />
        </div>
      )}

      <Form onSubmit={handleSubmit(onSubmitHandler)}>
        {error && <FormError values={[error]} />}

        <div className="sm:mb-4">
          <BottleCard bottle={initialData.bottle} color="highlight" />
        </div>

        <Fieldset>
          <RangeField
            {...register("rating", {
              valueAsNumber: true,
              setValueAs: (v) => (v === "" ? undefined : Number(v)),
            })}
            error={errors.rating}
            label="Rating"
          />

          <Controller
            name="tags"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                error={errors.tags}
                label="Flavors"
                targetOptions={5}
                options={suggestedTags.results.map((t) => ({
                  id: t.tag,
                  name: toTitleCase(t.tag),
                  count: t.count,
                }))}
                onChange={(value) => onChange(value.map((t: any) => t.id))}
                value={value?.map((t) => ({
                  id: t,
                  name: toTitleCase(t),
                }))}
                multiple
              />
            )}
          />

          <TextAreaField
            {...register("notes")}
            error={errors.notes}
            label="Comments"
            placeholder="Tell us how you really feel."
          />

          <ImageField
            name="image"
            label="Picture"
            onChange={(value) => setPicture(value)}
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
                targetOptions={servingStyleList.length}
                options={servingStyleList}
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
                value={friendsValue}
              />
            )}
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
