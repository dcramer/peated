import { zodResolver } from "@hookform/resolvers/zod";
import { BottleSeriesInputSchema } from "@peated/server/schemas";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import Fieldset from "./fieldset";
import Form from "./form";
import FormHeader from "./formHeader";
import LayoutModal from "./layoutModal";
import SelectField from "./selectField";
import { type CreateFormOptions, type Option } from "./selectField/types";
import TextField from "./textField";

type FormSchemaType = z.infer<typeof BottleSeriesInputSchema>;

export default function SeriesField({
  createDialogHelpText,
  brand,
  ...props
}: React.ComponentProps<typeof SelectField> & {
  createDialogHelpText?: string;
  brand: number;
}) {
  const orpc = useORPC();
  return (
    <SelectField<Option>
      onQuery={async (query) => {
        const { results } = await orpc.bottleSeries.list.call({
          query,
          brand,
        });
        return results;
      }}
      onRenderOption={(item) => (
        <div className="flex flex-col items-start">
          <div>{item.name}</div>
          {item.description && (
            <div className="text-muted font-normal">{item.description}</div>
          )}
        </div>
      )}
      createForm={(props) => (
        <CreateForm
          createDialogHelpText={createDialogHelpText}
          brandId={brand}
          {...props}
        />
      )}
      {...props}
    />
  );
}

function CreateForm({
  createDialogHelpText = "Add a new series for this brand.",
  brandId,
  data,
  onSubmit,
  onClose,
}: CreateFormOptions<Option> & {
  createDialogHelpText?: string;
  brandId: number;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(BottleSeriesInputSchema),
    defaultValues: {
      brand: brandId,
      ...data,
    },
  });

  return (
    <LayoutModal
      header={
        <FormHeader
          title="Add Series"
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
            label="Name"
            {...register("name")}
            error={errors.name}
            helpText={BottleSeriesInputSchema.shape.name.description}
            required
          />
          <TextField
            label="Description"
            {...register("description")}
            error={errors.description}
            helpText={BottleSeriesInputSchema.shape.description.description}
          />
        </Fieldset>
      </Form>
    </LayoutModal>
  );
}
