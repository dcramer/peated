import { zodResolver } from "@hookform/resolvers/zod";
import { EntityMergeSchema } from "@peated/server/schemas";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import invariant from "tiny-invariant";
import type { z } from "zod";
import ChoiceField from "~/components/choiceField";
import EntityField from "~/components/entityField";
import Fieldset from "~/components/fieldset";
import Form from "~/components/form";
import FormError from "~/components/formError";
import FormHeader from "~/components/formHeader";
import Header from "~/components/header";
import Layout from "~/components/layout";
import Spinner from "~/components/spinner";
import { trpc } from "~/lib/trpc";

type FormSchemaType = z.infer<typeof EntityMergeSchema>;

export const meta: MetaFunction = () => {
  return [
    {
      title: "Merge Entity",
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
  const { entity } = useLoaderData<typeof loader>();
  const trpcUtils = trpc.useUtils();

  const [otherEntityName, setOtherEntityName] = useState<string>("Other");

  // TODO: move to queries
  const entityMergeMutation = trpc.entityMerge.useMutation({
    onSuccess: (newEntity) => {
      const previous = trpcUtils.entityById.getData(newEntity.id);
      trpcUtils.entityById.setData(newEntity.id, {
        ...previous,
        ...newEntity,
      });
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
    await entityMergeMutation.mutateAsync(
      {
        root: entity.id,
        other: data.entityId,
        direction: data.direction,
      },
      {
        onSuccess: (newEntity) => navigate(`/entities/${newEntity.id}`),
      },
    );
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
