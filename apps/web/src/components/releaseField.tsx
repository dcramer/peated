import { zodResolver } from "@hookform/resolvers/zod";
import { CASK_FILLS, CASK_SIZES, CASK_TYPES } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import { BottleReleaseInputSchema } from "@peated/server/schemas";
import { useORPC } from "@peated/web/lib/orpc/context";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import BooleanField from "./booleanField";
import Fieldset from "./fieldset";
import Form from "./form";
import FormHeader from "./formHeader";
import LayoutModal from "./layoutModal";
import Legend from "./legend";
import SelectField from "./selectField";
import { type CreateFormOptions, type Option } from "./selectField/types";
import TextField from "./textField";

type FormSchemaType = z.infer<typeof BottleReleaseInputSchema>;

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

export default function ReleaseField({
  createDialogHelpText,
  bottle,
  ...props
}: React.ComponentProps<typeof SelectField> & {
  createDialogHelpText?: string;
  bottle: number;
}) {
  const orpc = useORPC();
  return (
    <SelectField<Option>
      onQuery={async (query) => {
        const { results } = await orpc.bottleReleases.list.call({
          query,
          bottle,
        });
        return results;
      }}
      onResults={(results) => {
        return results.map((result) => ({
          name:
            result.name ??
            result.edition ??
            result.vintageYear ??
            result.releaseYear ??
            result.abv ??
            "Unnamed Release",
          ...result,
        }));
      }}
      onRenderOption={(item) => (
        <div className="flex flex-col items-start">
          <div>{item.name}</div>
        </div>
      )}
      createForm={(props) => {
        return (
          <CreateForm createDialogHelpText={createDialogHelpText} {...props} />
        );
      }}
      {...props}
    />
  );
}

function CreateForm({
  createDialogHelpText = "Most values of the release are optional, and we'll come up with a canonical name based on what's present.",
  data,
  onSubmit,
  onClose,
}: CreateFormOptions<Option> & {
  createDialogHelpText?: string;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(BottleReleaseInputSchema),
    defaultValues: {
      edition: data.name ?? "",
    },
  });

  return (
    <LayoutModal
      header={
        <FormHeader
          title="Add Release of Bottle"
          onSave={handleSubmit(onSubmit)}
          saveDisabled={isSubmitting}
          onClose={onClose}
        />
      }
    >
      {!!createDialogHelpText && (
        <div className="border-y border-slate-700 p-3 lg:mb-4 lg:border lg:p-4">
          <div className="prose prose-invert text-muted max-w-full text-sm leading-6">
            {createDialogHelpText}
          </div>
        </div>
      )}

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSubmit(onSubmit)(e);
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
    </LayoutModal>
  );
}
