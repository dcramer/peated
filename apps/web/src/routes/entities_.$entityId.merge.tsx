import { zodResolver } from "@hookform/resolvers/zod";
import { EntityMergeSchema } from "@peated/server/schemas";
import ChoiceField from "@peated/web/components/choiceField";
import EntityField from "@peated/web/components/entityField";
import Fieldset from "@peated/web/components/fieldset";
import { useFlashMessages } from "@peated/web/components/flash";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchemaType = z.infer<typeof EntityMergeSchema>;

export const Route = createFileRoute("/entities_/$entityId/merge")({
  component: Page,
});

function Page() {
  useModRequired();

  const { entityId } = Route.useParams();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { data: entity } = useSuspenseQuery(
    orpc.entities.details.queryOptions({ input: { entity: Number(entityId) } })
  );
  const { flash } = useFlashMessages();

  const navigate = useNavigate();

  const [otherEntityName, setOtherEntityName] = useState<string>("Other");

  const entityMergeMutation = useMutation({
    ...orpc.entities.merge.mutationOptions(),
    onSuccess: (newEntity) => {
      queryClient.invalidateQueries({
        queryKey: orpc.entities.details.key({
          input: { entity: newEntity.id },
        }),
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
        entity: entity.id,
        other: data.entityId,
        direction: data.direction,
      },
      {
        onSuccess: (newEntity) => {
          flash(
            <div>
              Performing merge asynchronously. Updates may take a few minutes.
            </div>
          );
          navigate({ to: `/entities/${newEntity.id}` });
        },
      }
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
    >
      <Form onSubmit={handleSubmit(onSubmit)} isSubmitting={isSubmitting}>
        {entityMergeMutation.isError && (
          <FormError values={[entityMergeMutation.error.message]} />
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
                id: "mergeFrom",
                name: `Merge "${otherEntityName}" into "${entity.name}"`,
              },
              {
                id: "mergeInto",
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
