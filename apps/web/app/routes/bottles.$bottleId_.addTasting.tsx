import { zodResolver } from "@hookform/resolvers/zod";
import { SERVING_STYLE_LIST } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import { TastingInputSchema } from "@peated/server/schemas";
import type { ServingStyle } from "@peated/server/types";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { TRPCClientError } from "@trpc/client";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import invariant from "tiny-invariant";
import type { z } from "zod";
import BottleCard from "~/components/bottleCard";
import Fieldset from "~/components/fieldset";
import FormError from "~/components/formError";
import FormHeader from "~/components/formHeader";
import Header from "~/components/header";
import ImageField from "~/components/imageField";
import Layout from "~/components/layout";
import RangeField from "~/components/rangeField";
import type { Option } from "~/components/selectField";
import SelectField from "~/components/selectField";
import Spinner from "~/components/spinner";
import TextAreaField from "~/components/textAreaField";
import useApi from "~/hooks/useApi";
import { redirectToAuth } from "~/lib/auth.server";
import { toBlob } from "~/lib/blobs";
import { logError } from "~/lib/log";
import { trpc } from "~/lib/trpc";

type FormSchemaType = z.infer<typeof TastingInputSchema>;

function formatServingStyle(style: ServingStyle) {
  return toTitleCase(style);
}

const servingStyleList = SERVING_STYLE_LIST.map((c) => ({
  id: c,
  name: formatServingStyle(c),
}));

export async function loader({
  request,
  params: { bottleId },
  context: { trpc, user },
}: LoaderFunctionArgs) {
  invariant(bottleId);

  if (!user) return redirectToAuth({ request });

  const bottle = await trpc.bottleById.query(Number(bottleId));
  const suggestedTags = await trpc.bottleSuggestedTagList.query({
    bottle: Number(bottleId),
  });

  return json({ bottle, suggestedTags });
}

export const meta: MetaFunction = () => {
  return [
    {
      title: "Record Tasting",
    },
  ];
};

export default function AddTasting() {
  const { bottle, suggestedTags } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [error, setError] = useState<string | undefined>();
  const [picture, setPicture] = useState<HTMLCanvasElement | null>(null);
  const [friendsValue, setFriendsValue] = useState<Option[]>([]);

  // capture this on initial load as its utilized to prevent
  // duplicate tasting submissions
  const createdAt = new Date().toISOString();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(TastingInputSchema),
    defaultValues: {
      bottle: bottle.id,
    },
  });

  const tastingCreateMutation = trpc.tastingCreate.useMutation();
  const api = useApi();

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    let tasting;
    try {
      tasting = await tastingCreateMutation.mutateAsync({
        ...data,
        createdAt,
      });
    } catch (err) {
      if (err instanceof TRPCClientError) {
        setError(err.message);
      } else {
        logError(err);
        setError("Internal error");
      }
    }

    if (!tasting) {
      setError("Internal error");
    }

    if (picture && tasting) {
      const blob = await toBlob(picture);
      try {
        // TODO: switch to fetch maybe?
        await api.post(`/tastings/${tasting.id}/image`, {
          data: {
            image: blob,
          },
        });
      } catch (err) {
        logError(err);
        // TODO show some kind of alert, ask them to reusubmit image
      }
    }
    if (tasting) navigate(`/tastings/${tasting.id}`);
  };

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title="Record Tasting"
            onSave={handleSubmit(onSubmit)}
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

      <form
        className="self-center bg-slate-950 pb-6 sm:mx-16 sm:my-6"
        onSubmit={handleSubmit(onSubmit)}
      >
        {error && <FormError values={[error]} />}

        <div className="sm:mb-4">
          <BottleCard bottle={bottle} color="highlight" />
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
                endpoint={{
                  path: "/friends",
                  query: {
                    status: "active",
                  },
                }}
                onResults={(data) => {
                  return data.map((d) => ({
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
      </form>
    </Layout>
  );
}
