import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { toTitleCase } from "@peated/shared/lib/strings";
import { EntityInputSchema } from "@peated/shared/schemas";

import CountryField from "../components/countryField";
import Fieldset from "../components/fieldset";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import Layout from "../components/layout";
import SelectField from "../components/selectField";
import TextField from "../components/textField";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api, { ApiError } from "../lib/api";
import { Entity } from "../types";

const entityTypes = [
  { id: "brand", name: "Brand" },
  { id: "distiller", name: "Distiller" },
  { id: "bottler", name: "Bottler" },
];

type FormSchemaType = z.infer<typeof EntityInputSchema>;

export default function EditEntity() {
  const navigate = useNavigate();

  const { entityId } = useParams();
  const { data: entity } = useSuspenseQuery(
    ["entity", entityId],
    (): Promise<Entity> => api.get(`/entities/${entityId}`),
    { cacheTime: 0 },
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(EntityInputSchema),
    defaultValues: {
      name: entity.name,
      country: entity.country,
      region: entity.region,
      type: entity.type,
    },
  });

  const [error, setError] = useState<string | undefined>();

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      await api.put(`/entities/${entity.id}`, {
        data,
      });
      navigate(`/entities/${entity.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        console.error(err);
        setError("Internal error");
      }
    }
  };

  return (
    <Layout
      header={
        <FormHeader
          title="Edit Entity"
          saveDisabled={isSubmitting}
          onSave={handleSubmit(onSubmit)}
        />
      }
      noFooter
    >
      <form className="sm:mx-16" onSubmit={handleSubmit(onSubmit)}>
        {error && <FormError values={[error]} />}

        <Fieldset>
          <TextField
            {...register("name")}
            error={errors.name}
            autoFocus
            label="Name"
            type="text"
            placeholder="e.g. Macallan"
            required
            autoComplete="off"
          />
          <Controller
            name="country"
            control={control}
            render={({ field: { ref, ...field } }) => (
              <CountryField
                {...field}
                error={errors.country}
                label="Country"
                placeholder="e.g. Scotland, United States of America"
                required
              />
            )}
          />
          <TextField
            {...register("region")}
            error={errors.region}
            label="Region"
            type="text"
            placeholder="e.g. Islay, Kentucky"
            autoComplete="off"
          />
          <Controller
            name="type"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                label="Type"
                onChange={(value) => onChange(value.map((t: any) => t.id))}
                value={value?.map((t) => ({
                  id: t,
                  name: toTitleCase(t),
                }))}
                suggestedOptions={entityTypes}
                options={entityTypes}
                multiple
              />
            )}
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
