import { ArrowDownIcon } from "@heroicons/react/20/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { NewTasting } from "@peated/shared/schemas";

import BottleCard from "../components/bottleCard";
import Fieldset from "../components/fieldset";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import ImageField from "../components/imageField";
import Layout from "../components/layout";
import RangeField from "../components/rangeField";
import SelectField from "../components/selectField";
import TextAreaField from "../components/textAreaField";
import TextField from "../components/textField";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api, { ApiError } from "../lib/api";
import { toTitleCase } from "../lib/strings";
import type { Bottle, Paginated } from "../types";

type Tag = {
  name: string;
  count: number;
};

type FormSchemaType = z.infer<typeof NewTasting>;

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
  const [image, setImage] = useState<string | File | undefined>();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(NewTasting),
    defaultValues: {
      bottle: bottle.id,
    },
  });

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    let tasting;
    try {
      tasting = await api.post("/tastings", {
        data,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        console.error(err);
        setError("Internal error");
      }
    }
    if (image) {
      try {
        await api.post(`/tastings/${tasting.id}/image`, {
          data: {
            image,
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
      header={
        <FormHeader
          title="Record Tasting"
          onSave={handleSubmit(onSubmit)}
          saveDisabled={isSubmitting}
        />
      }
    >
      <form className="mx-auto my-6 max-w-xl" onSubmit={handleSubmit(onSubmit)}>
        {error && <FormError values={[error]} />}

        <div className="sm:mb-4">
          <BottleCard bottle={bottle} color="highlight" />
        </div>

        <Fieldset>
          <RangeField
            label="Rating"
            error={errors.rating}
            {...register("rating", {
              valueAsNumber: true,
              setValueAs: (v) => (v === "" ? undefined : parseInt(v, 10)),
            })}
          />

          <Controller
            name="tags"
            control={control}
            render={({ field: { name, onChange, value, ref, ...field } }) => (
              <SelectField
                label="Flavors"
                error={errors.tags}
                name={name}
                targetOptions={5}
                options={suggestedTags.map((t) => ({
                  id: t.name,
                  name: toTitleCase(t.name),
                  count: t.count,
                }))}
                {...field}
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
            label="Tasting Notes"
            error={errors.notes}
            {...register("notes")}
            placeholder="Is it peated?"
          />

          <ImageField
            name="image"
            label="Picture"
            value={image}
            onChange={(e) =>
              setImage(e.target.files?.length ? e.target.files[0] : undefined)
            }
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
            type="number"
            {...register("vintageYear", {
              // valueAsNumber: true,
              // SIGH https://github.com/orgs/react-hook-form/discussions/6980
              setValueAs: (v) => (v === "" || !v ? undefined : parseInt(v, 10)),
            })}
            error={errors.vintageYear}
            label="Year"
            placeholder="e.g. 2023"
          />
          <TextField
            {...register("edition")}
            error={errors.edition}
            label="Edition"
            placeholder="e.g. Healthy Spirits"
          />
          <TextField
            type="number"
            {...register("barrel", {
              // valueAsNumber: true,
              setValueAs: (v) => (v === "" || !v ? undefined : parseInt(v, 10)),
            })}
            error={errors.barrel}
            label="Barrel No."
            placeholder="e.g. 56"
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
