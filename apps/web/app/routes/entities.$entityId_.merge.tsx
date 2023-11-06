import { zodResolver } from "@hookform/resolvers/zod";
import type { LoaderFunction } from "@remix-run/node";
import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate, useParams } from "@remix-run/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import invariant from "tiny-invariant";
import type { z } from "zod";

import { EntityMergeSchema } from "@peated/core/schemas";
import type { Entity } from "@peated/core/types";
import { useState } from "react";
import ChoiceField from "~/components/choiceField";
import EntityField from "~/components/entityField";
import Fieldset from "~/components/fieldset";
import Form from "~/components/form";
import FormError from "~/components/formError";
import FormHeader from "~/components/formHeader";
import Header from "~/components/header";
import Layout from "~/components/layout";
import Spinner from "~/components/spinner";
import useApi from "~/hooks/useApi";
import { getEntity } from "~/queries/entities";

type FormSchemaType = z.infer<typeof EntityMergeSchema>;

export const meta: MetaFunction = () => {
  return [
    {
      title: "Merge Entity",
    },
  ];
};

export const loader: LoaderFunction = async ({ params, context }) => {
  invariant(params.entityId);
  const entity = await getEntity(context.api, params.entityId);

  return json({ entity });
};

export default function EditEntity() {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { entity } = useLoaderData<typeof loader>();
  const { entityId } = useParams();

  const [otherEntityName, setOtherEntityName] = useState<string>("Other");

  // TODO: move to queries
  const mergeEntity = useMutation({
    mutationFn: async (
      data: FormSchemaType,
    ): Promise<[FormSchemaType, Entity]> => {
      const newEntity = await api.post(`/entities/${entityId}/merge`, {
        data,
      });
      return [data, newEntity];
    },
    onSuccess: ([data, newEntity]) => {
      queryClient.invalidateQueries(["entities", data.entityId]);
      queryClient.invalidateQueries(["entities", entityId]);
      queryClient.setQueryData(["entities", newEntity.id], newEntity);
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(EntityMergeSchema),
    defaultValues: {
      direction: "mergeInto",
    },
  });

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    await mergeEntity.mutateAsync(data, {
      onSuccess: ([_, newEntity]) => navigate(`/entities/${newEntity.id}`),
    });
  };

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title="Merge Entity"
            saveDisabled={isSubmitting}
            onSave={handleSubmit(onSubmit)}
            saveLabel="Continue"
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
        {mergeEntity.isError && (
          <FormError values={[(mergeEntity.error as Error).message]} />
        )}

        <Fieldset>
          <Controller
            name="entityId"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <EntityField
                {...field}
                error={errors.entityId}
                label="Other Entity"
                helpText="The brand, or main label of the bottle."
                placeholder="e.g. Angel's Envy, Hibiki"
                required
                onChange={(value) => {
                  onChange(value?.id);
                  setOtherEntityName(value?.name || "Other");
                }}
                onResults={(results) => {
                  return results.filter((r) => r.id !== entity.id);
                }}
              />
            )}
          />
          <ChoiceField
            control={control}
            name="direction"
            label="Direction"
            required
            choices={[
              {
                id: "mergeInto",
                name: `Merge "${otherEntityName}" into "${entity.name}"`,
              },
              {
                id: "mergeFrom",
                name: `Merge "${entity.name}" into "${otherEntityName}"`,
              },
            ]}
            error={errors.direction}
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
