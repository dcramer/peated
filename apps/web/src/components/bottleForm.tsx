"use client";

import { CATEGORY_LIST, FLAVOR_PROFILES } from "@peated/server/constants";
import { BottleCreateInputSchema } from "@peated/server/lib/bottleSchemas";
import {
  formatCategoryName,
  formatFlavorProfile,
} from "@peated/server/lib/format";
import { toTitleCase } from "@peated/server/lib/strings";
import {
  BottleInputFields,
  EntityChoiceSchema,
  FlavorProfileEnum,
} from "@peated/server/schemas";
import type { Entity, EntityKind } from "@peated/server/types";
import {
  BottleIdentityRow,
  Button,
  EntityPicker,
  Field,
  FieldGroup,
  FormActions,
  FormDetails,
  FormGrid,
  FormNotice,
  FormSection,
  FormStack,
  PictureInput,
  SearchPicker,
  Select,
  Switch,
  Textarea,
  TextInput,
  UnitInput,
  type EntityPickerOption,
  type SearchPickerOption,
} from "@peated/web/components/designSystem/components";
import { WorkflowScreen } from "@peated/web/components/designSystem/patterns/workflowScreen.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import {
  getFormErrorMessage,
  toChoiceValue,
} from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useMutation, useQuery } from "@tanstack/react-query";
import { WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const categoryList = CATEGORY_LIST.map((category) => ({
  id: category,
  name: formatCategoryName(category),
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

function booleanChoiceValue(value: string) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function booleanChoiceId(value: boolean | null | undefined) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}

type FormSchemaType = z.infer<typeof BottleCreateInputSchema>;
type ChoiceLike = { id?: number | null; name: string };
const ChoiceLikeSchema = z.object({
  id: z.number().nullable().optional(),
  name: z.string(),
});
const CatalogEntityMarkerSchema = z.object({ peatedId: z.string() });

function isNumericChoice(value: number | Entity | ChoiceLike): value is number {
  return z.number().safeParse(value).success;
}

function isCatalogEntity(value: number | Entity | ChoiceLike): value is Entity {
  return CatalogEntityMarkerSchema.safeParse(value).success;
}

function isDraftSeries(
  value: number | ChoiceLike | null | undefined,
): value is ChoiceLike {
  const parsed = ChoiceLikeSchema.safeParse(value);
  return parsed.success && !parsed.data.id;
}

function seriesChoiceId(value: number | ChoiceLike | null | undefined) {
  const numeric = z.number().safeParse(value);
  if (numeric.success) return String(numeric.data);
  const choice = ChoiceLikeSchema.safeParse(value);
  return choice.success && choice.data.id ? String(choice.data.id) : "";
}

export type BottleFormInitialData = Partial<
  Omit<FormSchemaType, "brand" | "distillers" | "bottler" | "series" | "image">
> & {
  bottler?: number | Entity | ChoiceLike | null;
  brand?: number | Entity | ChoiceLike | null;
  distillers?: Array<number | Entity | ChoiceLike>;
  imageUrl?: string | null;
  series?: number | ChoiceLike | null;
};

export type BottleFormSubmitValue = Omit<FormSchemaType, "image"> & {
  image: File | null | undefined;
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
  "maturation",
  "caskNumber",
  "outturn",
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

function toEntityChoiceValue(
  value: number | Entity | ChoiceLike | null | undefined,
): FormSchemaType["brand"] | FormSchemaType["bottler"] {
  return z
    .union([EntityChoiceSchema, z.null(), z.undefined()])
    .parse(toChoiceValue(value));
}

function toSeriesChoiceValue(
  value: number | ChoiceLike | null | undefined,
): FormSchemaType["series"] {
  return BottleInputFields.series.parse(toChoiceValue(value));
}

function toDistillerChoiceValues(
  values: Array<number | Entity | ChoiceLike> | null | undefined,
): NonNullable<FormSchemaType["distillers"]> {
  return z
    .array(EntityChoiceSchema)
    .parse(values?.map((value) => toChoiceValue(value)) ?? []);
}

function choiceName(value: number | Entity | ChoiceLike) {
  return isNumericChoice(value) ? `Entity ${value}` : value.name;
}

function choiceId(value: number | Entity | ChoiceLike) {
  if (isNumericChoice(value)) return String(value);
  return value.id ? String(value.id) : `new:${value.name}`;
}

function choiceDetail(value: number | Entity | ChoiceLike) {
  if (isNumericChoice(value)) return "Catalog entity";
  if (isCatalogEntity(value)) {
    return [toTitleCase(value.kind), value.region?.name ?? value.country?.name]
      .filter(Boolean)
      .join(" · ");
  }
  return value.id ? "Catalog entity" : "New entity";
}

function toEntityPickerOption(
  value: number | Entity | ChoiceLike | null | undefined,
): EntityPickerOption | null {
  if (value === null || value === undefined) return null;
  return {
    detail: choiceDetail(value),
    id: choiceId(value),
    meta: isCatalogEntity(value) ? value.peatedId : "Bottle form",
    name: choiceName(value),
  };
}

function toSearchPickerOption(
  value: number | Entity | ChoiceLike,
): SearchPickerOption {
  return {
    detail: choiceDetail(value),
    id: choiceId(value),
    label: choiceName(value),
  };
}

function entityPickerOption(entity: Entity): EntityPickerOption {
  return {
    detail: choiceDetail(entity),
    id: String(entity.id),
    meta: entity.peatedId,
    name: entity.name,
  };
}

function entitySearchOption(entity: Entity): SearchPickerOption {
  return {
    detail: choiceDetail(entity),
    id: String(entity.id),
    label: entity.name,
  };
}

function entityChoiceFromOption(
  option: EntityPickerOption,
  kind: EntityKind,
): z.infer<typeof EntityChoiceSchema> {
  return option.id.startsWith("new:")
    ? EntityChoiceSchema.parse({ kind, name: option.name })
    : Number(option.id);
}

function distillerChoiceFromOption(
  option: SearchPickerOption,
): z.infer<typeof EntityChoiceSchema> {
  return String(option.id).startsWith("new:")
    ? EntityChoiceSchema.parse({ kind: "distillery", name: option.label })
    : Number(option.id);
}

function draftSeries(name: string): NonNullable<FormSchemaType["series"]> {
  return BottleInputFields.series.parse({ name })!;
}

function makeDraftEntityOption(
  name: string,
  kind: EntityKind,
): EntityPickerOption {
  return {
    detail: `New ${toTitleCase(kind).toLocaleLowerCase()}`,
    id: `new:${name}`,
    meta: "Will be created on save",
    name,
  };
}

function numberOrNull(value: string) {
  return value ? Number(value) : null;
}

export default function BottleForm({
  initialData,
  onSubmit,
  returnTo,
  saveLabel = "Save bottle",
  title,
}: {
  initialData: BottleFormInitialData;
  onSubmit: (
    value: BottleFormSubmitValue,
    meta: BottleFormSubmitMeta,
  ) => void | Promise<void>;
  returnTo?: string | null;
  saveLabel?: string;
  title: string;
}) {
  const { imageUrl, ...initialFormData } = initialData;
  const orpc = useORPC();
  const { user } = useAuth();
  const [submitError, setSubmitError] = useState<string>();
  const [brandQuery, setBrandQuery] = useState("");
  const [bottlerQuery, setBottlerQuery] = useState("");
  const [distillerQuery, setDistillerQuery] = useState("");
  const [brand, setBrand] = useState<EntityPickerOption | null>(() =>
    toEntityPickerOption(initialData.brand),
  );
  const [bottler, setBottler] = useState<EntityPickerOption | null>(() =>
    toEntityPickerOption(initialData.bottler),
  );
  const [distillers, setDistillers] = useState<readonly SearchPickerOption[]>(
    () => initialData.distillers?.map(toSearchPickerOption) ?? [],
  );
  const [seriesMode, setSeriesMode] = useState(() => {
    const series = initialData.series;
    return isDraftSeries(series) ? "new" : "";
  });
  const [newSeriesName, setNewSeriesName] = useState(() => {
    const series = initialData.series;
    return isDraftSeries(series) ? series.name : "";
  });
  const [image, setImage] = useState<File | null | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState(imageUrl ?? undefined);
  const {
    control,
    formState: { dirtyFields, errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm<FormSchemaType>({
    defaultValues: {
      ...initialFormData,
      bottler: toEntityChoiceValue(initialData.bottler),
      brand: toEntityChoiceValue(initialData.brand) ?? undefined,
      distillers: toDistillerChoiceValues(initialData.distillers),
      series: toSeriesChoiceValue(initialData.series),
    },
    resolver: zodResolver(BottleCreateInputSchema),
  });

  const brandResults = useQuery(
    orpc.entities.list.queryOptions({
      input: {
        limit: 25,
        query: brandQuery,
        sort: brandQuery ? "rank" : "name",
      },
    }),
  );
  const bottlerResults = useQuery(
    orpc.entities.list.queryOptions({
      input: {
        limit: 25,
        query: bottlerQuery,
        sort: bottlerQuery ? "rank" : "name",
      },
    }),
  );
  const distillerResults = useQuery(
    orpc.entities.list.queryOptions({
      input: {
        limit: 25,
        query: distillerQuery,
        sort: distillerQuery ? "rank" : "name",
      },
    }),
  );
  const numericBrandId = brand && /^\d+$/.test(brand.id) ? Number(brand.id) : 0;
  const seriesResults = useQuery({
    ...orpc.bottleSeries.list.queryOptions({
      input: { brand: numericBrandId, limit: 100, query: "" },
    }),
    enabled: Boolean(numericBrandId),
  });
  const generateData = useMutation(orpc.ai.bottleLookup.mutationOptions());
  const name = watch("name");
  const category = watch("category");
  const statedAge = watch("statedAge");
  const noAgeStatement = watch("noAgeStatement");
  const abv = watch("abv");
  const previewMetadata = useMemo(
    () =>
      [
        category ? formatCategoryName(category) : null,
        noAgeStatement ? "NAS" : statedAge != null ? `${statedAge} yr` : null,
        abv != null ? `${abv}%` : null,
      ].filter((item): item is string => Boolean(item)),
    [abv, category, noAgeStatement, statedAge],
  );

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const submit: SubmitHandler<FormSchemaType> = async (data) => {
    setSubmitError(undefined);
    try {
      await onSubmit(
        { image, ...data },
        {
          // SAFETY: react-hook-form keys come from this form's typed field map.
          dirtyFields: new Set(
            Object.keys(dirtyFields) as Array<keyof FormSchemaType>,
          ),
        },
      );
    } catch (error) {
      setSubmitError(
        getFormErrorMessage(error, { allowAnyErrorMessage: true }),
      );
    }
  };

  async function fillDetails() {
    const result = await generateData.mutateAsync(getValues());
    if (!result) return;
    const current = getValues();
    if (result.description && !current.description) {
      setValue("description", result.description, { shouldDirty: true });
      setValue("descriptionSrc", "generated", { shouldDirty: true });
    }
    if (result.flavorProfile && !current.flavorProfile) {
      setValue("flavorProfile", FlavorProfileEnum.parse(result.flavorProfile), {
        shouldDirty: true,
      });
    }
  }

  return (
    <WorkflowScreen
      onClose={returnTo ? () => window.location.assign(returnTo) : undefined}
      onSave={handleSubmit(submit)}
      saveLabel={saveLabel}
      saving={isSubmitting}
      title={title}
    >
      <form onSubmit={handleSubmit(submit)}>
        <FormStack>
          <FormNotice>
            Add what you can confirm from the label. Brand and bottle name are
            required. You can leave everything else blank.
          </FormNotice>
          {name || brand ? (
            <BottleIdentityRow
              brand={brand?.name}
              metadata={previewMetadata}
              name={name || "Bottle preview"}
            />
          ) : null}
          {submitError ? (
            <FormNotice role="alert">{submitError}</FormNotice>
          ) : null}
          <FormSection title="Identity">
            <EntityPicker
              error={errors.brand?.message}
              help="The main label the bottle is sold under."
              kind="brand"
              loading={brandResults.isFetching}
              onChange={(option) => {
                setBrand(option);
                const nextBrand = option
                  ? entityChoiceFromOption(option, "brand")
                  : undefined;
                // SAFETY: the form can hold an empty required field until schema validation runs.
                setValue("brand", nextBrand as FormSchemaType["brand"], {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                setValue("series", null, { shouldDirty: true });
                setSeriesMode("");
                setNewSeriesName("");
              }}
              onCreate={(query) => {
                const option = makeDraftEntityOption(query, "brand");
                setBrand(option);
                setValue(
                  "brand",
                  EntityChoiceSchema.parse({ kind: "brand", name: query }),
                  {
                    shouldDirty: true,
                    shouldValidate: true,
                  },
                );
              }}
              onQueryChange={setBrandQuery}
              options={(brandResults.data?.results ?? []).map(
                entityPickerOption,
              )}
              placeholder="Laphroaig"
              required
              value={brand}
            />
            <Field
              error={errors.name?.message}
              htmlFor="bottle-name"
              label="Bottle name"
              required
            >
              <TextInput
                {...register("name")}
                autoFocus
                id="bottle-name"
                invalid={Boolean(errors.name)}
                placeholder="12-year-old"
              />
            </Field>
            <Field
              error={errors.category?.message}
              htmlFor="bottle-category"
              label="Type"
              optional
            >
              <Select
                {...register("category", {
                  setValueAs: (value) => value || null,
                })}
                id="bottle-category"
                invalid={Boolean(errors.category)}
              >
                <option value="">Not set</option>
                {categoryList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <FormGrid>
              <Field
                error={errors.statedAge?.message}
                htmlFor="bottle-age"
                label="Age statement"
                optional
              >
                <UnitInput
                  {...register("statedAge", {
                    setValueAs: (value) => numberOrNull(value),
                  })}
                  disabled={noAgeStatement === true}
                  id="bottle-age"
                  invalid={Boolean(errors.statedAge)}
                  min={0}
                  placeholder="12"
                  unit="years"
                />
              </Field>
              <Field
                error={errors.noAgeStatement?.message}
                htmlFor="bottle-age-information"
                label="Age information"
                optional
              >
                <Controller
                  control={control}
                  name="noAgeStatement"
                  render={({ field }) => (
                    <Select
                      id="bottle-age-information"
                      onChange={(event) => {
                        const next = booleanChoiceValue(
                          event.currentTarget.value,
                        );
                        field.onChange(next);
                        if (next) {
                          setValue("statedAge", null, { shouldDirty: true });
                        }
                      }}
                      value={booleanChoiceId(field.value)}
                    >
                      {noAgeStatementChoices.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.name}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </Field>
            </FormGrid>
            <Field
              error={errors.abv?.message}
              htmlFor="bottle-abv"
              label="Alcohol"
              optional
            >
              <UnitInput
                {...register("abv", {
                  setValueAs: (value) => numberOrNull(value),
                })}
                id="bottle-abv"
                invalid={Boolean(errors.abv)}
                max={100}
                min={0}
                placeholder="40.5"
                step="0.1"
                unit="% ABV"
              />
            </Field>
            <SearchPicker
              help="The distilleries that produced the spirit."
              label="Distilled by"
              loading={distillerResults.isFetching}
              onChange={(options) => {
                setDistillers(options);
                setValue("distillers", options.map(distillerChoiceFromOption), {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              onCreate={(query) => {
                const option: SearchPickerOption = {
                  detail: "New distillery",
                  id: `new:${query}`,
                  label: query,
                };
                const next = [...distillers, option];
                setDistillers(next);
                setValue("distillers", next.map(distillerChoiceFromOption), {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              onQueryChange={setDistillerQuery}
              options={(distillerResults.data?.results ?? []).map(
                entitySearchOption,
              )}
              placeholder="Search distilleries"
              value={distillers}
            />
            <EntityPicker
              help="The market-facing bottler or release imprint, when one is stated."
              kind="bottler"
              loading={bottlerResults.isFetching}
              onChange={(option) => {
                setBottler(option);
                setValue(
                  "bottler",
                  option ? entityChoiceFromOption(option, "bottler") : null,
                  { shouldDirty: true, shouldValidate: true },
                );
              }}
              onCreate={(query) => {
                const option = makeDraftEntityOption(query, "bottler");
                setBottler(option);
                setValue(
                  "bottler",
                  EntityChoiceSchema.parse({ kind: "bottler", name: query }),
                  {
                    shouldDirty: true,
                    shouldValidate: true,
                  },
                );
              }}
              onQueryChange={setBottlerQuery}
              options={(bottlerResults.data?.results ?? []).map(
                entityPickerOption,
              )}
              placeholder="Search bottlers"
              value={bottler}
            />
          </FormSection>

          <FormDetails
            defaultOpen={hasMoreDetails(initialData)}
            description="Edition, year, cask, production, and catalog information."
            title="More details"
          >
            <Field
              error={errors.edition?.message}
              htmlFor="bottle-edition"
              label="Edition or batch"
              optional
            >
              <TextInput
                {...register("edition", {
                  setValueAs: (value) => value || null,
                })}
                id="bottle-edition"
                invalid={Boolean(errors.edition)}
                placeholder="Batch 24"
              />
            </Field>
            <Field
              error={errors.series?.message}
              htmlFor="bottle-series"
              label="Series"
              optional
            >
              <Select
                disabled={!brand}
                id="bottle-series"
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  setSeriesMode(next);
                  if (!next) setValue("series", null, { shouldDirty: true });
                  else if (next === "new") {
                    setValue("series", draftSeries(newSeriesName), {
                      shouldDirty: true,
                    });
                  } else {
                    setValue("series", Number(next), { shouldDirty: true });
                  }
                }}
                value={seriesMode || seriesChoiceId(initialData.series)}
              >
                <option value="">Not set</option>
                {seriesResults.data?.results.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                <option value="new">Add a new series…</option>
              </Select>
            </Field>
            {seriesMode === "new" ? (
              <Field
                error={errors.series?.message}
                htmlFor="bottle-new-series"
                label="New series name"
                required
              >
                <TextInput
                  id="bottle-new-series"
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    setNewSeriesName(next);
                    setValue("series", draftSeries(next), {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  value={newSeriesName}
                />
              </Field>
            ) : null}
            <FormGrid>
              <YearField
                error={errors.vintageYear?.message}
                id="bottle-distillation-year"
                label="Distillation year"
                register={register("vintageYear", {
                  setValueAs: (value) => numberOrNull(value),
                })}
              />
              <YearField
                error={errors.bottlingYear?.message}
                id="bottle-bottling-year"
                label="Bottling year"
                register={register("bottlingYear", {
                  setValueAs: (value) => numberOrNull(value),
                })}
              />
              <YearField
                error={errors.releaseYear?.message}
                id="bottle-release-year"
                label="Release year"
                register={register("releaseYear", {
                  setValueAs: (value) => numberOrNull(value),
                })}
              />
              <Field
                error={errors.releaseDate?.message}
                htmlFor="bottle-release-date"
                label="Exact release date"
                optional
              >
                <TextInput
                  {...register("releaseDate", {
                    setValueAs: (value) => value || null,
                  })}
                  format="data"
                  id="bottle-release-date"
                  invalid={Boolean(errors.releaseDate)}
                  type="date"
                />
              </Field>
            </FormGrid>
            <Controller
              control={control}
              name="singleCask"
              render={({ field }) => (
                <Switch
                  checked={Boolean(field.value)}
                  description="The label states that this is a single-cask bottling."
                  label="Single cask"
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="caskStrength"
              render={({ field }) => (
                <Switch
                  checked={Boolean(field.value)}
                  description="The label states that this was bottled at cask strength."
                  label="Cask strength"
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <FormGrid>
              <BooleanSelectField
                choices={colorChoices}
                id="bottle-color"
                label="Color"
                onChange={(value) =>
                  setValue("naturalColor", value, { shouldDirty: true })
                }
                value={watch("naturalColor")}
              />
              <BooleanSelectField
                choices={filtrationChoices}
                id="bottle-filtration"
                label="Filtration"
                onChange={(value) =>
                  setValue("nonChillFiltered", value, { shouldDirty: true })
                }
                value={watch("nonChillFiltered")}
              />
            </FormGrid>
            <Field
              error={errors.maltPhenolPpm?.message}
              htmlFor="bottle-ppm"
              label="Phenol level"
              optional
            >
              <UnitInput
                {...register("maltPhenolPpm", {
                  setValueAs: (value) => numberOrNull(value),
                })}
                id="bottle-ppm"
                invalid={Boolean(errors.maltPhenolPpm)}
                min={0}
                placeholder="101.4"
                step="0.1"
                unit="PPM"
              />
            </Field>
            <Field
              error={errors.maturation?.message}
              hint="Use the producer's cask or maturation wording."
              htmlFor="bottle-maturation"
              label="Maturation"
              optional
            >
              <Textarea
                {...register("maturation", {
                  setValueAs: (value) => value?.trim() || null,
                })}
                id="bottle-maturation"
                invalid={Boolean(errors.maturation)}
                placeholder="2nd fill ex-bourbon hogshead"
                rows={3}
              />
            </Field>
            <FormGrid>
              <Field
                error={errors.caskNumber?.message}
                htmlFor="bottle-cask-number"
                label="Cask number"
                optional
              >
                <TextInput
                  {...register("caskNumber", {
                    setValueAs: (value) => value?.trim() || null,
                  })}
                  id="bottle-cask-number"
                  invalid={Boolean(errors.caskNumber)}
                  placeholder="35.401"
                />
              </Field>
              <Field
                error={errors.outturn?.message}
                htmlFor="bottle-outturn"
                label="Outturn"
                optional
              >
                <UnitInput
                  {...register("outturn", {
                    setValueAs: (value) => numberOrNull(value),
                  })}
                  id="bottle-outturn"
                  invalid={Boolean(errors.outturn)}
                  min={1}
                  placeholder="240"
                  unit="bottles"
                />
              </Field>
            </FormGrid>
            <Field
              error={errors.flavorProfile?.message}
              htmlFor="bottle-flavor-profile"
              label="Flavor profile"
              optional
            >
              <Select
                {...register("flavorProfile", {
                  setValueAs: (value) => value || null,
                })}
                id="bottle-flavor-profile"
                invalid={Boolean(errors.flavorProfile)}
              >
                <option value="">Not set</option>
                {FLAVOR_PROFILES.map((profile) => (
                  <option key={profile} value={profile}>
                    {formatFlavorProfile(profile)}
                  </option>
                ))}
              </Select>
            </Field>
            {user?.mod || user?.admin ? (
              <FormActions>
                <Button
                  loading={generateData.isPending}
                  onClick={() => void fillDetails()}
                  size="sm"
                  variant="tonal"
                >
                  <WandSparkles aria-hidden="true" size={15} />
                  Fill description
                </Button>
              </FormActions>
            ) : null}
            <FieldGroup label="Catalog image" optional>
              <PictureInput
                disabled={isSubmitting}
                id="bottle-image"
                label="Add a bottle image"
                name="image"
                onFilesSelected={(files) => {
                  const file = files.item(0);
                  if (!file) return;
                  setImage(file);
                  setImagePreview(URL.createObjectURL(file));
                }}
                onRemove={
                  imagePreview
                    ? () => {
                        setImage(null);
                        setImagePreview(undefined);
                      }
                    : undefined
                }
                preview={
                  imagePreview
                    ? { alt: "Current bottle image", src: imagePreview }
                    : undefined
                }
              />
            </FieldGroup>
            <Field
              error={errors.description?.message}
              htmlFor="bottle-description"
              label="Description"
              optional
            >
              <Textarea
                {...register("description", {
                  onChange: () =>
                    setValue("descriptionSrc", "user", { shouldDirty: true }),
                  setValueAs: (value) => value || null,
                })}
                id="bottle-description"
                invalid={Boolean(errors.description)}
                rows={8}
              />
            </Field>
          </FormDetails>
        </FormStack>
      </form>
    </WorkflowScreen>
  );
}

function YearField({
  error,
  id,
  label,
  register,
}: {
  error?: string;
  id: string;
  label: string;
  register: ReturnType<ReturnType<typeof useForm<FormSchemaType>>["register"]>;
}) {
  return (
    <Field error={error} htmlFor={id} label={label} optional>
      <TextInput
        {...register}
        format="data"
        id={id}
        invalid={Boolean(error)}
        max={new Date().getFullYear()}
        min={1800}
        placeholder="2024"
        type="number"
      />
    </Field>
  );
}

function BooleanSelectField({
  choices,
  id,
  label,
  onChange,
  value,
}: {
  choices: readonly BooleanChoice[];
  id: string;
  label: string;
  onChange: (value: boolean | null) => void;
  value: boolean | null | undefined;
}) {
  return (
    <Field htmlFor={id} label={label} optional>
      <Select
        id={id}
        onChange={(event) =>
          onChange(booleanChoiceValue(event.currentTarget.value))
        }
        value={booleanChoiceId(value)}
      >
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
