import { zodResolver } from "@hookform/resolvers/zod";
import { BottleMergeSchema } from "@peated/server/schemas";
import BottleField from "@peated/web/components/bottleField";
import ChoiceField from "@peated/web/components/choiceField";
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
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchemaType = z.infer<typeof BottleMergeSchema>;

export const Route = createFileRoute("/bottles/$bottleId/merge")({
  component: Page,
});

function Page() {
  useModRequired();

  const { bottleId } = Route.useParams();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: Number(bottleId) } }),
  );
  const { flash } = useFlashMessages();

  const navigate = useNavigate();

  const [otherBottleName, setOtherBottleName] = useState<string>("Other");

  const bottleMergeMutation = useMutation({
    ...orpc.bottles.merge.mutationOptions(),
    onSuccess: (newBottle) => {
      queryClient.invalidateQueries({
        queryKey: orpc.bottles.details.key({
          input: { bottle: newBottle.id },
        }),
      });
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(BottleMergeSchema),
    defaultValues: {
      direction: "mergeInto",
    },
  });

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    await bottleMergeMutation.mutateAsync(
      {
        bottle: bottle.id,
        other: data.bottleId,
        direction: data.direction,
      },
      {
        onSuccess: (newBottle) => {
          flash(
            <div>
              Performing merge asynchronously. Updates may take a few minutes.
            </div>,
          );
          navigate({ to: `/bottles/${newBottle.id}` });
        },
      },
    );
  };

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title="Merge Bottle"
            saveDisabled={isSubmitting}
            onSave={handleSubmit(onSubmit)}
            saveLabel="Continue"
          />
        </Header>
      }
    >
      <Form onSubmit={handleSubmit(onSubmit)} isSubmitting={isSubmitting}>
        {bottleMergeMutation.isError && (
          <FormError values={[bottleMergeMutation.error.message]} />
        )}

        <Fieldset>
          <Controller
            name="bottleId"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <BottleField
                {...field}
                error={errors.bottleId}
                label="Other Bottle"
                required
                onChange={(value) => {
                  onChange(value?.id);
                  setOtherBottleName(value?.name || "Other");
                }}
                onResults={(results) => {
                  return results.filter((r) => r.id !== bottle.id);
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
                name: `Merge "${otherBottleName}" into "${bottle.fullName}"`,
              },
              {
                id: "mergeInto",
                name: `Merge "${bottle.fullName}" into "${otherBottleName}"`,
              },
            ]}
            error={errors.direction}
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
