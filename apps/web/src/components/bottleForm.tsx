"use client";

import { BoltIcon } from "@heroicons/react/20/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CASK_FILLS,
  CASK_SIZES,
  CASK_TYPES,
  CATEGORY_LIST,
  FLAVOR_PROFILES,
} from "@peated/server/constants";
import {
  formatCategoryName,
  formatFlavorProfile,
  notesForProfile,
} from "@peated/server/lib/format";
import { BottleInputSchema } from "@peated/server/schemas";
import { toTitleCase } from "@peated/server/src/lib/strings";
import type { Bottle, Entity, FlavorProfile } from "@peated/server/types";
import { PreviewBottleCard } from "@peated/web/components/bottleCard";
import EntityField from "@peated/web/components/entityField";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Layout from "@peated/web/components/layout";
import type { Option } from "@peated/web/components/selectField";
import SelectField from "@peated/web/components/selectField";
import TextField from "@peated/web/components/textField";
import config from "@peated/web/config";
import { logError } from "@peated/web/lib/log";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import useAuth from "../hooks/useAuth";
import { isTRPCClientError, trpc } from "../lib/trpc";
import Button from "./button";
import Collapsable from "./collapsable";
import { classesForProfile } from "./flavorProfile";
import Form from "./form";
import Header from "./header";
import Legend from "./legend";
import TextAreaField from "./textAreaField";

const categoryList = CATEGORY_LIST.map((c) => ({
  id: c,
  name: formatCategoryName(c),
}));

const entityToOption = (entity: Entity): Option => {
  return {
    id: entity.id,
    name: entity.name,
  };
};

const flavorProfileList = FLAVOR_PROFILES.map((c) => ({
  id: c,
  name: formatFlavorProfile(c),
}));

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

type FormSchemaType = z.infer<typeof BottleInputSchema>;

export default function BottleForm({
  onSubmit,
  initialData,
  title,
  returnTo,
}: {
  onSubmit: SubmitHandler<FormSchemaType>;
  initialData: Partial<Bottle>;
  title: string;
  returnTo?: string | null;
}) {
  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(BottleInputSchema),
    defaultValues: {
      ...initialData,
      bottler: initialData.bottler?.id,
      brand: initialData.brand?.id,
      distillers: initialData.distillers
        ? initialData.distillers.map((d) => d.id)
        : [],
    },
  });

  const { user } = useAuth();

  const [error, setError] = useState<string | undefined>();
  const router = useRouter();

  const generateDataMutation = trpc.bottleGenerateDetails.useMutation();

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

  const [brandValue, setBrandValue] = useState<Option | undefined>(
    initialData.brand ? entityToOption(initialData.brand) : undefined,
  );
  const [distillersValue, setDistillersValue] = useState<Option[]>(
    initialData.distillers ? initialData.distillers.map(entityToOption) : [],
  );
  const [bottlerValue, setBottlerValue] = useState<Option | undefined>(
    initialData.bottler ? entityToOption(initialData.bottler) : undefined,
  );

  const [showCaskDetails, setShowCaskDetails] = useState(false);
  const [showAddDetails, setShowAddDetails] = useState(false);

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title={title}
            saveDisabled={isSubmitting}
            onSave={handleSubmit(onSubmitHandler)}
            onClose={() => (returnTo ? router.push(returnTo) : router.back())}
          />
        </Header>
      }
      footer={null}
    >
      <Form
        onSubmit={handleSubmit(onSubmitHandler)}
        isSubmitting={isSubmitting}
      >
        {error && <FormError values={[error]} />}

        <div className="border-y border-slate-700 p-3 lg:mb-4 lg:border lg:p-4">
          <div className="prose prose-invert text-light max-w-full text-sm leading-6">
            <p>
              It can be tricky to find the right information, so if you&apos;re
              struggling, just try to fill in the components that you're
              confident about. The brand will almost always have multiple
              bottles (e.g. <em>Hibiki</em>), and the bottle name, if nothing
              else, you can use the full bottle label.
            </p>
            <p>
              Have any suggestions for making it easier to enter correct data?{" "}
              <a href={config.GITHUB_REPO}>Open an Issue on GitHub</a> or{" "}
              <a href={config.DISCORD_LINK}>drop a note on Discord</a> if you
              have feedback. We'll update the bottle preview as you enter
              information.
            </p>
          </div>
        </div>

        <div className="sm:mb-4">
          <PreviewBottleCard
            data={{
              name: watch("name"),
              category: watch("category"),
              statedAge: watch("statedAge"),
              distillers: distillersValue,
              brand: brandValue,
              vintageYear: watch("vintageYear"),
            }}
          />
        </div>

        <Fieldset>
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
                createDialogHelpText="The brand is the label the spirit is bottled under. Sometimes this is
                the same as the distiller."
                searchContext={{
                  type: "brand",
                }}
                required
                onChange={(value) => {
                  onChange(value?.id || value);
                  setBrandValue(value);
                }}
                canCreate
                value={brandValue}
              />
            )}
          />

          <TextField
            {...register("name")}
            error={errors.name}
            type="text"
            label="Bottle"
            required
            helpText="The name of the bottle."
            placeholder="e.g. 12-year-old"
          />

          <TextField
            {...register("statedAge", {
              setValueAs: (v) => (v === "" || !v ? null : Number(v)),
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
                simple
                options={categoryList}
                onChange={(value) => onChange(value?.id)}
                value={
                  value
                    ? {
                        id: value,
                        name: formatCategoryName(value),
                      }
                    : undefined
                }
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
                searchContext={{
                  type: "distiller",
                  brand: brandValue ? Number(brandValue.id) : null,
                  bottleName: watch("name"),
                }}
                label="Distiller"
                placeholder="e.g. Angel's Envy, Suntory Whisky"
                helpText="The distilleries which produce the spirit(s) for this bottle."
                createDialogHelpText="The distiller is the group that makes the spirit."
                suggestedOptions={brandValue ? [brandValue] : []}
                onChange={(value) => {
                  onChange(value.map((t: any) => t.id || t));
                  setDistillersValue(value);
                }}
                canCreate
                value={distillersValue}
                multiple
              />
            )}
          />

          <TextField
            {...register("vintageYear", {
              setValueAs: (v) => (v === "" || !v ? null : Number(v)),
            })}
            error={errors.vintageYear}
            type="number"
            label="Vintage Year"
            placeholder="e.g. 2024"
            helpText="The year this spirit was distilled and transferred to a cask."
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
                suggestedOptions={brandValue ? [brandValue] : []}
                searchContext={{
                  type: "bottler",
                  brand: brandValue ? Number(brandValue.id) : null,
                  bottleName: watch("name"),
                }}
                onChange={(value) => {
                  onChange(value?.id || value);
                  setBottlerValue(value);
                }}
                canCreate
                value={bottlerValue}
              />
            )}
          />
        </Fieldset>

        <Fieldset>
          <Legend
            title="Cask Details"
            isCollapsed={showCaskDetails}
            onCollapse={() => setShowCaskDetails(!showCaskDetails)}
          />
          <Collapsable open={showCaskDetails}>
            <Controller
              name="caskFill"
              control={control}
              render={({ field: { onChange, value, ref, ...field } }) => (
                <SelectField
                  {...field}
                  error={errors.category}
                  label="Cask Fill"
                  placeholder="e.g. 1st Fill"
                  simple
                  options={caskFillList}
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

            <Controller
              name="caskType"
              control={control}
              render={({ field: { onChange, value, ref, ...field } }) => (
                <SelectField
                  {...field}
                  error={errors.category}
                  label="Cask Type"
                  placeholder="e.g. Bourbon"
                  simple
                  options={caskTypeList}
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

            <Controller
              name="caskSize"
              control={control}
              render={({ field: { onChange, value, ref, ...field } }) => (
                <SelectField
                  {...field}
                  error={errors.category}
                  label="Cask Size"
                  placeholder="e.g. Hogshead"
                  simple
                  options={caskSizeList}
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
          </Collapsable>
        </Fieldset>

        <Fieldset>
          <Legend
            title="Additional Details"
            isCollapsed={showAddDetails}
            onCollapse={() => setShowAddDetails(!showAddDetails)}
          >
            {user && (user.mod || user.admin) && (
              <Button
                color="primary"
                onClick={async () => {
                  const result =
                    await generateDataMutation.mutateAsync(getValues());

                  if (!result) return;
                  const currentValues = getValues();
                  if (result.description && !currentValues.description) {
                    setValue("description", result.description);
                    setValue("descriptionSrc", "generated");
                  }

                  if (result.flavorProfile && !currentValues.flavorProfile)
                    setValue(
                      "flavorProfile",
                      result.flavorProfile as FlavorProfile,
                    );
                }}
                disabled={generateDataMutation.isPending}
                icon={<BoltIcon className="-ml-0.5 h-4 w-4" />}
              >
                Help me fill this in [Beta]
              </Button>
            )}
          </Legend>
          <Collapsable open={showAddDetails}>
            <Controller
              name="flavorProfile"
              control={control}
              render={({ field: { onChange, value, ref, ...field } }) => (
                <SelectField
                  {...field}
                  error={errors.flavorProfile}
                  placeholder="The flavor profile of the spirit."
                  suggestedOptions={[]}
                  label="Flavor Profile"
                  onRenderOption={(option) => {
                    const classes = classesForProfile(
                      option.id as FlavorProfile,
                    );
                    return (
                      <div className="flex flex-col items-start justify-start gap-y-2 text-left">
                        <h4
                          className={`${classes.bg} ${classes.bgHover} rounded px-2 py-1`}
                        >
                          {option.name}
                        </h4>
                        <div className="text-light text-sm font-normal">
                          {notesForProfile(option.id as FlavorProfile)}
                        </div>
                      </div>
                    );
                  }}
                  options={flavorProfileList}
                  onChange={(value) => onChange(value?.id)}
                  value={
                    value
                      ? {
                          id: value,
                          name: formatFlavorProfile(value),
                        }
                      : undefined
                  }
                />
              )}
            />

            {user && (user.mod || user.admin) && (
              <TextAreaField
                {...register("description", {
                  setValueAs: (v) => (v === "" || !v ? null : v),
                  onChange: () => {
                    setValue("descriptionSrc", "user");
                  },
                })}
                error={errors.description}
                label="Description"
                rows={8}
              />
            )}

            <TextField
              {...register("releaseDate", {
                setValueAs: (v) => (v === "" || !v ? null : v),
              })}
              error={errors.releaseDate}
              type="date"
              label="Release Date"
              placeholder="e.g. 2024-05-01"
              helpText="The date this labeling was released."
            />
          </Collapsable>
        </Fieldset>
      </Form>
    </Layout>
  );
}
