import { zodResolver } from "@hookform/resolvers/zod";
import { CASK_FILLS, CASK_SIZES, CASK_TYPES } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import { BottleReleaseInputSchema } from "@peated/server/schemas";
import type { Bottle } from "@peated/server/types";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import SelectField from "@peated/web/components/selectField";
import TextField from "@peated/web/components/textField";
import { isTRPCClientError } from "@peated/web/lib/trpc/client";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { logError } from "../lib/log";
import BooleanField from "./booleanField";
import BottleCard from "./bottleCard";
import Legend from "./legend";

const caskFillList = CASK_FILLS.map((id) => ({
  id,
  name: toTitleCase(id),
}));

const caskSizeList = CASK_SIZES.map(({ id }) => ({
  id,
  name: toTitleCase(id),
}));

const caskTypeList = CASK_TYPES.map(({ id }) => ({
  id,
  name: toTitleCase(id),
}));

type FormSchemaType = z.infer<typeof BottleReleaseInputSchema>;

export default function ReleaseForm({
  bottle,
  onSubmit,
  initialData = {},
  title,
}: {
  bottle: Bottle;
  onSubmit: SubmitHandler<FormSchemaType>;
  initialData?: Partial<FormSchemaType>;
  title: string;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(BottleReleaseInputSchema),
    defaultValues: initialData,
  });

  const [error, setError] = useState<string | undefined>();

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      await onSubmit(data);
    } catch (err) {
      if (isTRPCClientError(err)) {
        setError(err.message);
      } else {
        logError(err);
        setError("Internal error");
      }
    }
  };

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title={title}
            saveDisabled={isSubmitting}
            onSave={handleSubmit(onSubmitHandler)}
          />
        </Header>
      }
      footer={null}
    >
      <div className="lg:mb-8 lg:p-0">
        <BottleCard bottle={bottle} color="highlight" />
      </div>

      {error && <FormError values={[error]} />}

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSubmit(onSubmitHandler)(e);
        }}
        isSubmitting={isSubmitting}
      >
        <Fieldset>
          <TextField
            {...register("edition")}
            error={errors.edition}
            autoFocus
            label="Edition"
            type="text"
            placeholder="e.g. Batch #1, Distillers Release"
            helpText={BottleReleaseInputSchema.shape.edition.description}
            autoComplete="off"
          />

          <TextField
            {...register("statedAge", {
              setValueAs: (v) => (v === "" || !v ? null : parseInt(v, 10)),
            })}
            error={errors.statedAge}
            type="number"
            label="Stated Age"
            placeholder="e.g. 12"
            helpText={BottleReleaseInputSchema.shape.statedAge.description}
            suffixLabel="years"
          />

          <TextField
            {...register("abv", {
              setValueAs: (v) => (v === "" || !v ? null : parseFloat(v)),
            })}
            error={errors.abv}
            type="number"
            label="ABV"
            placeholder="e.g. 40.5"
            helpText={BottleReleaseInputSchema.shape.abv.description}
            suffixLabel="%"
            step="0.1"
            min="0"
            max="100"
          />

          <TextField
            {...register("releaseYear", {
              setValueAs: (v) => (v === "" || !v ? null : parseInt(v, 10)),
            })}
            error={errors.releaseYear}
            type="number"
            label="Release Year"
            placeholder="e.g. 1994"
            min="1800"
            max={new Date().getFullYear() + 1}
            helpText={BottleReleaseInputSchema.shape.releaseYear.description}
          />

          <TextField
            {...register("vintageYear", {
              setValueAs: (v) => (v === "" || !v ? null : parseInt(v, 10)),
            })}
            error={errors.vintageYear}
            type="number"
            label="Vintage Year"
            placeholder="e.g. 2024"
            min="1800"
            max={new Date().getFullYear() + 1}
            helpText={BottleReleaseInputSchema.shape.vintageYear.description}
          />
        </Fieldset>

        <Fieldset>
          <Legend title="Cask Specifics" />
          <BooleanField
            control={control}
            label="Single Cask"
            helpText={BottleReleaseInputSchema.shape.singleCask.description}
            name="singleCask"
          />

          <BooleanField
            control={control}
            label="Cask Strength"
            helpText={BottleReleaseInputSchema.shape.caskStrength.description}
            name="caskStrength"
          />

          <Controller
            name="caskFill"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                error={errors.caskFill}
                label="Cask Fill"
                placeholder="e.g. 1st Fill"
                helpText={BottleReleaseInputSchema.shape.caskFill.description}
                simple
                options={caskFillList}
                onChange={(value) => onChange(value?.id)}
                value={
                  value ? caskFillList.find((i) => i.id === value) : undefined
                }
              />
            )}
          />

          <Controller
            name="caskType"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                error={errors.caskType}
                label="Cask Type"
                placeholder="e.g. Bourbon"
                helpText={BottleReleaseInputSchema.shape.caskType.description}
                simple
                options={caskTypeList}
                onChange={(value) => onChange(value?.id)}
                value={
                  value ? caskTypeList.find((i) => i.id === value) : undefined
                }
              />
            )}
          />

          <Controller
            name="caskSize"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                error={errors.caskSize}
                label="Cask Size"
                placeholder="e.g. Hogshead"
                helpText={BottleReleaseInputSchema.shape.caskSize.description}
                simple
                options={caskSizeList}
                onChange={(value) => onChange(value?.id)}
                value={
                  value ? caskSizeList.find((i) => i.id === value) : undefined
                }
              />
            )}
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
