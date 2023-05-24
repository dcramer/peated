import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { BottleInputSchema } from "@peated/shared/schemas";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";

import { toTitleCase } from "@peated/shared/lib/strings";
import { PreviewBottleCard } from "../components/bottleCard";

import EntityField from "../components/entityField";
import Fieldset from "../components/fieldset";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import Layout from "../components/layout";
import SelectField, { Option } from "../components/selectField";
import TextField from "../components/textField";
import { useRequiredAuth } from "../hooks/useAuth";
import { ApiError } from "../lib/api";
import { formatCategoryName } from "../lib/strings";
import { Bottle, Entity } from "../types";
import Header from "./header";

const categoryList = [
  "blend",
  "bourbon",
  "rye",
  "single_grain",
  "single_malt",
  "spirit",
].map((c) => ({
  id: c,
  name: formatCategoryName(c),
}));

const entityToOption = (entity: Entity): Option => {
  return {
    id: entity.id,
    name: entity.name,
  };
};

type FormSchemaType = z.infer<typeof BottleInputSchema>;

export default ({
  onSubmit,
  initialData,
  title,
}: {
  onSubmit: SubmitHandler<FormSchemaType>;
  initialData: Partial<Bottle>;
  title: string;
}) => {
  const { user } = useRequiredAuth();

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(BottleInputSchema),
    defaultValues: {
      name: initialData.name,
      category: initialData.category,
      bottler: initialData.bottler?.id,
      brand: initialData.brand?.id,
      distillers: initialData.distillers
        ? initialData.distillers.map((d) => d.id)
        : [],
      statedAge: initialData.statedAge,
    },
  });

  const [error, setError] = useState<string | undefined>();

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      await onSubmit(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        console.error(err);
        setError("Internal error");
      }
    }
  };

  const [brandValue, setBrandValue] = useState<Option | undefined>(
    initialData.brand ? entityToOption(initialData.brand) : undefined,
  );
  const [distillersValue, setDistillersValue] = useState<Option[]>(
    initialData.distillers ? initialData.distillers.map(entityToOption) : [],
  );
  const [bottlerValue, setBottlerValue] = useState<Option | undefined>(
    initialData.bottler ? entityToOption(initialData.bottler) : undefined,
  );

  return (
    <Layout
      title={title}
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
      <form className="sm:mx-16" onSubmit={handleSubmit(onSubmitHandler)}>
        {error && <FormError values={[error]} />}

        <div className="sm:mb-4">
          <PreviewBottleCard
            data={{
              name: watch("name"),
              category: watch("category"),
              statedAge: watch("statedAge"),
              distillers: distillersValue,
              brand: brandValue,
            }}
          />
        </div>

        <Fieldset>
          <TextField
            {...register("name")}
            error={errors.name}
            type="text"
            label="Bottle"
            required
            helpText="The full name of the bottle, excluding its specific cask information."
            placeholder="e.g. 12-year-old"
          />

          <Controller
            name="brand"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <EntityField
                {...field}
                error={errors.brand}
                label="Brand"
                helpText="The brand, or main label of the bottle."
                placeholder="e.g. Angel's Envy, Hibiki"
                createDialogHelpText="The brand is the group that bottles the spirit. Sometimes this is
                the same as the distiller."
                required
                canCreate={user.admin}
                onChange={(value) => {
                  onChange(value?.id || value);
                  setBrandValue(value);
                }}
                value={brandValue}
              />
            )}
          />

          <Controller
            name="distillers"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <EntityField
                {...field}
                error={errors.distillers}
                label="Distiller"
                placeholder="e.g. Angel's Envy, Suntory Whisky"
                helpText="The distilleries which produces the spirit(s) for this bottle."
                createDialogHelpText="The distiller is the group that makes the spirit."
                onChange={(value) => {
                  onChange(value.map((t: any) => t.id || t));
                  setDistillersValue(value);
                }}
                value={distillersValue}
                canCreate={user.admin}
                multiple
              />
            )}
          />

          <Controller
            name="bottler"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <EntityField
                {...field}
                error={errors.bottler}
                label="Bottler"
                helpText="The company bottling the spirit."
                placeholder="e.g. The Scotch Malt Whisky Society"
                canCreate={user.admin}
                onChange={(value) => {
                  onChange(value?.id || value);
                  setBottlerValue(value);
                }}
                value={bottlerValue}
              />
            )}
          />

          <TextField
            {...register("statedAge", {
              setValueAs: (v) => (v === "" || !v ? undefined : parseInt(v, 10)),
            })}
            error={errors.statedAge}
            type="number"
            label="Stated Age"
            placeholder="e.g. 12"
            helpText="The number of years the spirit was aged."
            suffixLabel="years"
          />

          <Controller
            name="category"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                error={errors.category}
                label="Category"
                placeholder="e.g. Single Malt"
                helpText="The kind of spirit."
                targetOptions={categoryList.length}
                options={categoryList}
                onChange={(value) => onChange(value?.id)}
                value={
                  value
                    ? {
                        id: value,
                        name: toTitleCase(value),
                      }
                    : undefined
                }
              />
            )}
          />
        </Fieldset>
      </form>
    </Layout>
  );
};
