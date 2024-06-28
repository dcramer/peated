"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EntityMergeSchema } from "@peated/server/schemas";
import ChoiceField from "@peated/web/components/choiceField";
import EntityField from "@peated/web/components/entityField";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

export const dynamic = "force-dynamic";

type FormSchemaType = z.infer<typeof EntityMergeSchema>;

export default function Page({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  useModRequired();

  const [entity] = trpc.entityById.useSuspenseQuery(Number(entityId));
  const trpcUtils = trpc.useUtils();

  const router = useRouter();

  const [otherEntityName, setOtherEntityName] = useState<string>("Other");

  // TODO: move to queries
  const entityMergeMutation = trpc.entityMerge.useMutation({
    onSuccess: (newEntity) => {
      trpcUtils.entityById.invalidate(newEntity.id);
      // const previous = trpcUtils.bottleById.getData(newBottle.id);
      // trpcUtils.bottleById.setData(newBottle.id, {
      //   ...previous,
      //   ...newBottle,
      // });
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
        onSuccess: (newEntity) => router.push(`/entities/${newEntity.id}`),
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
