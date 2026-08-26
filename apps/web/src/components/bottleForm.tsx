"use client";

import {
  BoltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/20/solid";
import {
  CASK_FILLS,
  CASK_SIZES,
  CASK_TYPES,
  CATEGORY_LIST,
  FLAVOR_PROFILES,
} from "@peated/server/constants";
import { BottleCreateInputSchema } from "@peated/server/lib/bottleSchemas";
import {
  formatCategoryName,
  formatFlavorProfile,
  notesForProfile,
} from "@peated/server/lib/format";
import { toTitleCase } from "@peated/server/lib/strings";
import {
  BottleInputFields,
  EntityChoiceSchema,
  FlavorProfileEnum,
} from "@peated/server/schemas";
import type { Entity, FlavorProfile } from "@peated/server/types";
import EntityField from "@peated/web/components/entityField";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormScreen from "@peated/web/components/formScreen";
import ImageField from "@peated/web/components/imageField";
import { PreviewBottleCard } from "@peated/web/components/previewBottleCard";
import type { Option } from "@peated/web/components/selectField";
import SelectField from "@peated/web/components/selectField";
import SeriesField from "@peated/web/components/seriesField";
import TextField from "@peated/web/components/textField";
import useAuth from "@peated/web/hooks/useAuth";
import {
  getFormErrorMessage,
  toChoiceValue,
  toOption,
  toOptionList,
} from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import BooleanField from "./booleanField";
import Button from "./button";
import { classesForProfile } from "./flavorProfile";
import Form from "./form";
import TextAreaField from "./textAreaField";

const categoryList = CATEGORY_LIST.map((c) => ({
  id: c,
  name: formatCategoryName(c),
}));

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

type BooleanChoice = {
  id: "unknown" | "yes" | "no";
  name: string;
};

const noAgeStatementChoices: BooleanChoice[] = [
  { id: "unknown", name: "Not known" },
  { id: "yes", name: "No age statement" },
];

const colorChoices: BooleanChoice[] = [
  { id: "unknown", name: "Not stated" },
  { id: "yes", name: "Natural color" },
  { id: "no", name: "Added coloring" },
];

const filtrationChoices: BooleanChoice[] = [
  { id: "unknown", name: "Not stated" },
  { id: "yes", name: "Non-chill-filtered" },
  { id: "no", name: "Chill-filtered" },
];

function booleanChoice(
  choices: BooleanChoice[],
  value: boolean | null | undefined,
) {
  const id = value === true ? "yes" : value === false ? "no" : "unknown";
  return choices.find((choice) => choice.id === id) ?? choices[0];
}

function booleanChoiceValue(choice: BooleanChoice | undefined) {
  if (choice?.id === "yes") return true;
  if (choice?.id === "no") return false;
  return null;
}

type CreateFormSchemaType = z.infer<typeof BottleCreateInputSchema>;
const BottleFormSchema = BottleCreateInputSchema;
type FormSchemaType = CreateFormSchemaType;
type ChoiceLike = {
  id?: number | null;
  name: string;
};
export type BottleFormInitialData = Partial<
  Omit<
    CreateFormSchemaType,
    "brand" | "distillers" | "bottler" | "series" | "image"
  >
> & {
  brand?: number | Entity | ChoiceLike | null;
  distillers?: Array<number | Entity | ChoiceLike>;
  bottler?: number | Entity | ChoiceLike | null;
  series?: number | ChoiceLike | null;
  imageUrl?: string | null;
};

export type BottleFormSubmitValue = Omit<FormSchemaType, "image"> & {
  image: HTMLCanvasElement | null | undefined;
};

export type BottleFormFieldName = keyof FormSchemaType;

export type BottleFormSubmitMeta = {
  dirtyFields: ReadonlySet<BottleFormFieldName>;
};

const moreDetailFields = [
  "edition",
  "vintageYear",
  "bottlingYear",
  "releaseYear",
  "releaseDate",
  "series",
  "singleCask",
  "caskStrength",
  "naturalColor",
  "nonChillFiltered",
  "maltPhenolPpm",
  "caskFill",
  "caskType",
  "caskSize",
  "flavorProfile",
  "description",
] as const satisfies ReadonlyArray<BottleFormFieldName>;

function hasMoreDetails(initialData: BottleFormInitialData) {
  return (
    Boolean(initialData.imageUrl) ||
    moreDetailFields.some((field) => {
      const value = initialData[field];
      return (
        value !== null && value !== undefined && value !== "" && value !== false
      );
    })
  );
}

const toEntityChoiceValue = (
  value: number | Entity | ChoiceLike | null | undefined,
): FormSchemaType["brand"] | FormSchemaType["bottler"] =>
  z
    .union([EntityChoiceSchema, z.null(), z.undefined()])
    .parse(toChoiceValue(value));

const toSeriesChoiceValue = (
  value: number | ChoiceLike | null | undefined,
): FormSchemaType["series"] =>
  BottleInputFields.series.parse(toChoiceValue(value));

const toDistillerChoiceValues = (
  values: Array<number | Entity | ChoiceLike> | null | undefined,
): NonNullable<FormSchemaType["distillers"]> =>
  z
    .array(EntityChoiceSchema)
    .parse(values?.map((value) => toChoiceValue(value)) ?? []);

export default function BottleForm({
  onSubmit,
  initialData,
  title,
  returnTo,
  saveLabel,
}: {
  onSubmit: (
    value: BottleFormSubmitValue,
    meta: BottleFormSubmitMeta,
  ) => void | Promise<void>;
  initialData: BottleFormInitialData;
  title: string;
  returnTo?: string | null;
  saveLabel?: string;
}) {
  const { imageUrl, ...initialFormData } = initialData;
  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { dirtyFields, errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(BottleFormSchema),
    defaultValues: {
      ...initialFormData,
      bottler: toEntityChoiceValue(initialData.bottler),
      brand: toEntityChoiceValue(initialData.brand) ?? undefined,
      distillers: toDistillerChoiceValues(initialData.distillers),
      series: toSeriesChoiceValue(initialData.series),
    },
  });

  const [error, setError] = useState<string | undefined>();
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(() =>
    hasMoreDetails(initialData),
  );
  const [image, setImage] = useState<HTMLCanvasElement | null | undefined>(
    undefined,
  );
  const router = useRouter();
  const orpc = useORPC();
  const { user } = useAuth();
  const canUseBottleLookup = !!(user?.mod || user?.admin);

  useEffect(() => {
    if (moreDetailFields.some((field) => errors[field])) {
      setMoreDetailsOpen(true);
    }
  }, [errors]);

  const generateDataMutation = useMutation(
    orpc.ai.bottleLookup.mutationOptions(),
  );

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      await onSubmit(
        { image, ...data },
        {
          dirtyFields: new Set(
            // SAFETY: React Hook Form creates dirtyFields only from this typed form's registered keys.
            Object.keys(dirtyFields) as Array<keyof FormSchemaType>,
          ),
        },
      );
    } catch (err) {
      setError(
        getFormErrorMessage(err, {
          allowAnyErrorMessage: true,
        }),
      );
    }
  };

  const [brandValue, setBrandValue] = useState<Option | undefined>(
    toOption(initialData.brand),
  );
  const [distillersValue, setDistillersValue] = useState<Option[]>(
    toOptionList(initialData.distillers),
  );
  const [bottlerValue, setBottlerValue] = useState<Option | undefined>(
    toOption(initialData.bottler),
  );
  const [seriesValue, setSeriesValue] = useState<Option | undefined>(
    toOption(initialData.series),
  );

  const previewData = {
    name: watch("name"),
    category: watch("category"),
    statedAge: watch("statedAge"),
    noAgeStatement: watch("noAgeStatement"),
    edition: watch("edition"),
    vintageYear: watch("vintageYear"),
    bottlingYear: watch("bottlingYear"),
    releaseYear: watch("releaseYear"),
    releaseDate: watch("releaseDate"),
    abv: watch("abv"),
    singleCask: watch("singleCask"),
    caskStrength: watch("caskStrength"),
    caskFill: watch("caskFill"),
    caskType: watch("caskType"),
    caskSize: watch("caskSize"),
    distillers: distillersValue,
    brand: brandValue,
    series: seriesValue,
  };
  const showPreview =
    Boolean(
      previewData.name ||
      previewData.category ||
      previewData.brand ||
      previewData.distillers.length,
    ) ||
    (previewData.statedAge !== null && previewData.statedAge !== undefined);

  return (
    <FormScreen
      title={title}
      saveDisabled={isSubmitting}
      saveLabel={saveLabel}
      onSave={handleSubmit(onSubmitHandler)}
      onClose={() => (returnTo ? router.push(returnTo) : router.back())}
    >
      <div className="border-slate-700 p-4 lg:mb-8 lg:border">
        <div className="prose prose-invert text-muted max-w-full text-sm leading-6">
          <p>
            Add what you can confirm from the label. Brand and bottle name are
            required; anything else can be left blank.
          </p>
        </div>
      </div>

      {showPreview && (
        <div className="lg:mb-8 lg:p-0">
          <PreviewBottleCard data={previewData} />
        </div>
      )}

      {error && <FormError values={[error]} />}

      <Form
        onSubmit={handleSubmit(onSubmitHandler)}
        isSubmitting={isSubmitting}
      >
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
                placeholder="e.g. Laphroaig"
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
            label="Bottle Name"
            required
            helpText="Enter the name without repeating the brand. Add edition, batch, and year information under More Details."
            placeholder="e.g. 12-year-old"
          />

          <Controller
            name="category"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                error={errors.category}
                label="Type"
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

          <TextField
            {...register("statedAge", {
              setValueAs: (v) => (v === "" || !v ? null : parseInt(v, 10)),
            })}
            error={errors.statedAge}
            type="number"
            label="Age Statement"
            placeholder="e.g. 12"
            helpText="The age shown on the bottle's label."
            suffixLabel="years"
            disabled={watch("noAgeStatement") === true}
          />

          <Controller
            name="noAgeStatement"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                error={errors.noAgeStatement}
                label="Age information"
                helpText="Choose No age statement only when the bottle label does not show an age."
                simple
                options={noAgeStatementChoices}
                onChange={(choice) => {
                  const noAgeStatement = booleanChoiceValue(choice);
                  onChange(noAgeStatement);
                  if (noAgeStatement) {
                    setValue("statedAge", null, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }
                }}
                value={booleanChoice(noAgeStatementChoices, value)}
              />
            )}
          />

          <TextField
            {...register("abv", {
              setValueAs: (v) => (v === "" || !v ? null : parseFloat(v)),
            })}
            error={errors.abv}
            type="number"
            label="Alcohol (ABV)"
            placeholder="e.g. 40.5"
            helpText="The alcohol percentage shown on the label."
            suffixLabel="%"
            step="0.1"
            min="0"
            max="100"
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
                  brand: brandValue?.id ? Number(brandValue.id) : null,
                  bottleName: watch("name"),
                }}
                label="Distilled By"
                placeholder="e.g. Angel's Envy, Suntory Whisky"
                helpText="The distilleries that produced the spirit."
                createDialogHelpText="The distiller is the group that makes the spirit."
                suggestedOptions={brandValue ? [brandValue] : []}
                onChange={(value) => {
                  onChange(value.map((option) => option.id || option));
                  setDistillersValue(value);
                }}
                canCreate
                value={distillersValue}
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
                helpText="Market-facing bottler or release imprint for this bottle. It may match the brand or distillery."
                placeholder="e.g. The Scotch Malt Whisky Society"
                suggestedOptions={brandValue ? [brandValue] : []}
                searchContext={{
                  type: "bottler",
                  brand: brandValue?.id ? Number(brandValue.id) : null,
                  bottleName: watch("name"),
                }}
                onChange={(value) => {
                  onChange(value?.id ?? value ?? null);
                  setBottlerValue(value);
                }}
                canCreate
                value={bottlerValue}
              />
            )}
          />
        </Fieldset>

        <Fieldset>
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-4 text-left"
            aria-controls="more-bottle-details"
            aria-expanded={moreDetailsOpen}
            onClick={() => setMoreDetailsOpen((open) => !open)}
          >
            <span>
              <span className="block text-lg font-medium">More Details</span>
              <span className="text-muted mt-1 block text-sm font-normal">
                Edition, batch, year, cask information, and other optional
                details.
              </span>
            </span>
            {moreDetailsOpen ? (
              <ChevronUpIcon className="text-muted h-5 w-5 shrink-0" />
            ) : (
              <ChevronDownIcon className="text-muted h-5 w-5 shrink-0" />
            )}
          </button>

          <div id="more-bottle-details" hidden={!moreDetailsOpen}>
            <TextField
              {...register("edition")}
              error={errors.edition}
              type="text"
              label="Edition or Batch"
              helpText="An edition, batch, or label shown on the bottle."
              placeholder="e.g. Batch 24"
            />

            <Controller
              name="series"
              control={control}
              render={({ field: { onChange, value, ref, ...field } }) => (
                <SeriesField
                  {...field}
                  error={errors.series}
                  label="Series"
                  helpText="The series this bottle belongs to, if any."
                  placeholder="e.g. A Midwinter Night's Dram"
                  brand={brandValue?.id ? Number(brandValue.id) : 0}
                  disabled={!brandValue}
                  canCreate
                  onChange={(value) => {
                    onChange(value?.id ?? value ?? null);
                    setSeriesValue(value);
                  }}
                  value={seriesValue}
                />
              )}
            />

            <TextField
              {...register("vintageYear", {
                setValueAs: (v) => (v === "" || !v ? null : parseInt(v, 10)),
              })}
              error={errors.vintageYear}
              type="number"
              label="Distillation Year"
              placeholder="e.g. 1986"
              helpText="The year the spirit was distilled."
            />

            <TextField
              {...register("bottlingYear", {
                setValueAs: (v) => (v === "" || !v ? null : parseInt(v, 10)),
              })}
              error={errors.bottlingYear}
              type="number"
              label="Bottling Year"
              placeholder="e.g. 2023"
              helpText="The year the whisky was bottled."
            />

            <TextField
              {...register("releaseYear", {
                setValueAs: (v) => (v === "" || !v ? null : parseInt(v, 10)),
              })}
              error={errors.releaseYear}
              type="number"
              label="Release Year"
              placeholder="e.g. 2024"
              helpText="The year this release became available."
            />

            <TextField
              {...register("releaseDate", {
                setValueAs: (v) => (v === "" || !v ? null : v),
              })}
              error={errors.releaseDate}
              type="date"
              label="Exact Release Date"
              helpText="The exact date this release became available, when known."
            />

            <BooleanField
              control={control}
              label="Single Cask"
              helpText="Shown as a single-cask bottling on the label."
              name="singleCask"
            />

            <BooleanField
              control={control}
              label="Cask Strength"
              helpText="Shown as cask strength on the label."
              name="caskStrength"
            />

            <Controller
              name="naturalColor"
              control={control}
              render={({ field: { onChange, value, ref, ...field } }) => (
                <SelectField
                  {...field}
                  label="Color"
                  helpText="Use what the bottle or producer states."
                  simple
                  options={colorChoices}
                  onChange={(choice) => onChange(booleanChoiceValue(choice))}
                  value={booleanChoice(colorChoices, value)}
                />
              )}
            />

            <Controller
              name="nonChillFiltered"
              control={control}
              render={({ field: { onChange, value, ref, ...field } }) => (
                <SelectField
                  {...field}
                  label="Filtration"
                  helpText="Use what the bottle or producer states."
                  simple
                  options={filtrationChoices}
                  onChange={(choice) => onChange(booleanChoiceValue(choice))}
                  value={booleanChoice(filtrationChoices, value)}
                />
              )}
            />

            <TextField
              {...register("maltPhenolPpm", {
                setValueAs: (v) => (v === "" || !v ? null : parseFloat(v)),
              })}
              error={errors.maltPhenolPpm}
              type="number"
              label="PPM"
              placeholder="e.g. 101.4"
              helpText="The phenol level of the malted barley, as stated by the producer for this bottle."
              step="0.1"
              min="0"
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
                  simple
                  options={caskFillList}
                  onChange={(value) => onChange(value?.id)}
                  value={
                    value
                      ? caskFillList.find((item) => item.id === value)
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
                  error={errors.caskType}
                  label="Cask Type"
                  placeholder="e.g. Bourbon"
                  simple
                  options={caskTypeList}
                  onChange={(value) => onChange(value?.id)}
                  value={
                    value
                      ? caskTypeList.find((item) => item.id === value)
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
                  error={errors.caskSize}
                  label="Cask Size"
                  placeholder="e.g. Hogshead"
                  simple
                  options={caskSizeList}
                  onChange={(value) => onChange(value?.id)}
                  value={
                    value
                      ? caskSizeList.find((item) => item.id === value)
                      : undefined
                  }
                />
              )}
            />

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
                    const profile = FlavorProfileEnum.parse(option.id);
                    const classes = classesForProfile(profile);
                    return (
                      <div className="flex flex-col items-start justify-start gap-y-2 text-left">
                        <h4
                          className={`${classes.bg} ${classes.bgHover} rounded px-2 py-1`}
                        >
                          {option.name}
                        </h4>
                        <div className="text-muted text-sm font-normal">
                          {notesForProfile(profile)}
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

            {canUseBottleLookup && (
              <div className="flex justify-end px-4 py-4">
                <Button
                  color="primary"
                  onClick={async () => {
                    const result =
                      await generateDataMutation.mutateAsync(getValues());

                    if (!result) return;
                    const currentValues = getValues();
                    if (result.description && !currentValues.description) {
                      setValue("description", result.description, {
                        shouldDirty: true,
                      });
                      setValue("descriptionSrc", "generated", {
                        shouldDirty: true,
                      });
                    }

                    if (result.flavorProfile && !currentValues.flavorProfile) {
                      setValue(
                        "flavorProfile",
                        FlavorProfileEnum.parse(result.flavorProfile),
                        { shouldDirty: true },
                      );
                    }
                  }}
                  disabled={generateDataMutation.isPending}
                  icon={<BoltIcon className="-ml-0.5 h-4 w-4" />}
                >
                  Suggest Description &amp; Flavor [Beta]
                </Button>
              </div>
            )}

            <ImageField
              name="image"
              label="Catalog Image"
              value={imageUrl}
              onChange={(value) => setImage(value)}
              noEditor
            />

            <TextAreaField
              {...register("description", {
                setValueAs: (v) => (v === "" || !v ? null : v),
                onChange: () => {
                  setValue("descriptionSrc", "user", { shouldDirty: true });
                },
              })}
              error={errors.description}
              label="Description"
              rows={8}
            />
          </div>
        </Fieldset>
      </Form>
    </FormScreen>
  );
}
