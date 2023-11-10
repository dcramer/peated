import { zodResolver } from "@hookform/resolvers/zod";
import { toTitleCase } from "@peated/server/lib/strings";
import { EntityInputSchema } from "@peated/server/schemas";
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useNavigate, useParams } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import invariant from "tiny-invariant";
import type { z } from "zod";
import CountryField from "~/components/countryField";
import Fieldset from "~/components/fieldset";
import Form from "~/components/form";
import FormError from "~/components/formError";
import FormHeader from "~/components/formHeader";
import Header from "~/components/header";
import Layout from "~/components/layout";
import SelectField from "~/components/selectField";
import Spinner from "~/components/spinner";
import TextField from "~/components/textField";
import { trpc } from "~/lib/trpc";

const entityTypes = [
  { id: "brand", name: "Brand" },
  { id: "distiller", name: "Distiller" },
  { id: "bottler", name: "Bottler" },
];

type FormSchemaType = z.infer<typeof EntityInputSchema>;

export const meta: MetaFunction = () => {
  return [
    {
      title: "Edit Entity",
    },
  ];
};

export async function loader({
  params: { entityId },
  context: { trpc },
}: LoaderFunctionArgs) {
  invariant(entityId);
  const entity = await trpc.entityById.query(Number(entityId));

  return json({ entity });
}

export default function EditEntity() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { entity } = useLoaderData<typeof loader>();
  const { entityId } = useParams();

  const entityUpdateMutation = trpc.entityUpdate.useMutation({
    onSuccess: (newEntity) => {
      const queryKey = getQueryKey(trpc.entityById, entity.id, "query");
      queryClient.setQueryData(queryKey, newEntity);
    },
  });

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
      yearEstablished: entity.yearEstablished,
      website: entity.website,
    },
  });

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    await entityUpdateMutation.mutateAsync(
      {
        ...data,
        entity: entity.id,
      },
      {
        onSuccess: () => navigate(`/entities/${entityId}`),
      },
    );
  };

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title="Edit Entity"
            saveDisabled={isSubmitting}
            onSave={handleSubmit(onSubmit)}
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

      <Form onSubmit={handleSubmit(onSubmit)}>
        {entityUpdateMutation.isError && (
          <FormError values={[(entityUpdateMutation.error as Error).message]} />
        )}

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
          <CountryField
            control={control}
            name="country"
            error={errors.country}
            label="Country"
            placeholder="e.g. Scotland, United States of America"
            required
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
                options={entityTypes}
                simple
                multiple
              />
            )}
          />
          <TextField
            {...register("website", {
              setValueAs: (v) => (v === "" || !v ? undefined : v),
            })}
            error={errors.website}
            autoFocus
            label="Website"
            type="text"
            placeholder="e.g. https://example.com"
            autoComplete="off"
          />
          <TextField
            {...register("yearEstablished", {
              setValueAs: (v) => (v === "" || !v ? undefined : Number(v)),
            })}
            error={errors.yearEstablished}
            autoFocus
            label="Year Established"
            type="number"
            placeholder="e.g. 1969"
            autoComplete="off"
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
