import { zodResolver } from "@hookform/resolvers/zod";
import { BottleMergeSchema } from "@peated/server/schemas";
import BottleField from "@peated/web/components/bottleField";
import ChoiceField from "@peated/web/components/choiceField";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import Spinner from "@peated/web/components/spinner";
import { trpc } from "@peated/web/lib/trpc";
import { type MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { json } from "@remix-run/server-runtime";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import invariant from "tiny-invariant";
import type { z } from "zod";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

type FormSchemaType = z.infer<typeof BottleMergeSchema>;

export const meta: MetaFunction = () => {
  return [
    {
      title: "Merge Bottle",
    },
  ];
};

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params: { bottleId }, context: { trpc } }) => {
    invariant(bottleId);

    const bottle = await trpc.bottleById.query(Number(bottleId));

    return json({ bottle });
  },
);

export default function MergeBottle() {
  const navigate = useNavigate();
  const { bottle } = useLoaderData<typeof loader>();
  const trpcUtils = trpc.useUtils();

  const [otherBottleName, setOtherBottleName] = useState<string>("Other");

  // TODO: move to queries
  const bottleMergeMutation = trpc.bottleMerge.useMutation({
    onSuccess: (newBottle) => {
      trpcUtils.bottleById.invalidate(newBottle.id);
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
    resolver: zodResolver(BottleMergeSchema),
    defaultValues: {
      direction: "mergeInto",
    },
  });

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    await bottleMergeMutation.mutateAsync(
      {
        root: bottle.id,
        other: data.bottleId,
        direction: data.direction,
      },
      {
        onSuccess: (newBottle) => navigate(`/bottles/${newBottle.id}`),
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
      footer={null}
    >
      {isSubmitting && (
        <div className="fixed inset-0 z-10">
          <div className="absolute inset-0 bg-slate-800 opacity-50" />
          <Spinner />
        </div>
      )}

      <Form onSubmit={handleSubmit(onSubmit)}>
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
                helpText="The brand, or main label of the bottle."
                placeholder="e.g. Angel's Envy, Hibiki"
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
