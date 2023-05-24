import { ArrowDownIcon } from "@heroicons/react/20/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { toTitleCase } from "@peated/shared/lib/strings";
import { TastingInputSchema } from "@peated/shared/schemas";

import BottleCard from "../components/bottleCard";
import Fieldset from "../components/fieldset";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import Header from "../components/header";
import ImageField from "../components/imageField";
import Layout from "../components/layout";
import RangeField from "../components/rangeField";
import SelectField from "../components/selectField";
import TextAreaField from "../components/textAreaField";
import TextField from "../components/textField";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api, { ApiError } from "../lib/api";
import { toBlob } from "../lib/blobs";
import type { Bottle, Paginated } from "../types";

type Tag = {
  tag: string;
  count: number;
};

type FormSchemaType = z.infer<typeof TastingInputSchema>;

export default function AddTasting() {
  const { bottleId } = useParams();
  const { data: bottle } = useSuspenseQuery(
    ["bottles", bottleId],
    (): Promise<Bottle> => api.get(`/bottles/${bottleId}`),
  );

  const {
    data: { results: suggestedTags },
  } = useSuspenseQuery(
    ["bottles", bottleId, "suggestedTags"],
    (): Promise<Paginated<Tag>> =>
      api.get(`/bottles/${bottleId}/suggestedTags`),
  );

  const navigate = useNavigate();

  const [error, setError] = useState<string | undefined>();
  const [picture, setPicture] = useState<HTMLCanvasElement | null>(null);

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

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    let tasting;
    try {
      tasting = await api.post("/tastings", {
        data: {
          ...data,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        console.error(err);
        setError("Internal error");
      }
    }

    if (picture) {
      const blob = await toBlob(picture);
      try {
        await api.post(`/tastings/${tasting.id}/image`, {
          data: {
            image: blob,
          },
        });
      } catch (err) {
        console.error(err);
        // TODO show some kind of alert, ask them to reusubmit image
      }
    }
    if (tasting) navigate(`/tastings/${tasting.id}`);
  };

  return (
    <Layout
      title="Record Tasting"
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
      <form
        className="max-w-xl self-center bg-slate-950 pb-6 sm:my-6"
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
              setValueAs: (v) => (v === "" ? undefined : parseInt(v, 10)),
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
                options={suggestedTags.map((t) => ({
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

          <div className="bg-highlight my-4 px-4 py-3 text-black">
            <div className="flex items-center">
              <div className="flex-1">
                <h2 className="font-medium">Vintage Details</h2>
                <p className="text-sm">Is this bottle a specific vintage?</p>
              </div>
              <ArrowDownIcon className="h-8 w-8 text-slate-700" />
            </div>
          </div>

          <TextField
            {...register("vintageYear", {
              // valueAsNumber: true,
              // SIGH https://github.com/orgs/react-hook-form/discussions/6980
              setValueAs: (v) => (v === "" || !v ? undefined : parseInt(v, 10)),
            })}
            error={errors.vintageYear}
            type="number"
            label="Year"
            placeholder="e.g. 2023"
          />
          <TextField
            {...register("series")}
            error={errors.series}
            label="Series"
            placeholder="e.g. Healthy Spirits"
          />
          <TextField
            {...register("barrel", {
              // valueAsNumber: true,
              setValueAs: (v) => (v === "" || !v ? undefined : parseInt(v, 10)),
            })}
            error={errors.barrel}
            type="number"
            label="Barrel No."
            placeholder="e.g. 56"
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
