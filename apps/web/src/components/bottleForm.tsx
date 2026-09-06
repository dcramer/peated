"use client";

import { CATEGORY_LIST, FLAVOR_PROFILES } from "@peated/server/constants";
import { BottleCreateInputSchema } from "@peated/server/lib/bottleSchemas";
import {
  formatCategoryName,
  formatFlavorProfile,
} from "@peated/server/lib/format";
import type { Inputs } from "@peated/server/orpc/router";
import {
  BottleInputFields,
  EntityChoiceSchema,
  FlavorProfileEnum,
  ImageLicenseSchema,
  ImageSourceUrlSchema,
} from "@peated/server/schemas";
import type { Entity, EntityKind } from "@peated/server/types";
import {
  BottleCreateCandidates,
  BottleCreateCandidateSummary,
  BottleIdentityRow,
  Button,
  EntityPicker,
  Field,
  FieldGroup,
  FormActions,
  FormDesktopOnly,
  FormDetails,
  FormGrid,
  FormNotice,
  FormSection,
  FormStack,
  FormStep,
  FormSteps,
  PictureInput,
  SearchPicker,
  Select,
  SeriesPicker,
  Switch,
  Textarea,
  TextInput,
  UnitInput,
  type BottleCreateCandidate,
  type EntityPickerOption,
  type SearchPickerOption,
  type SeriesPickerOption,
} from "@peated/web/components";
import { WorkflowScreen } from "@peated/web/components/workflowScreen.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { getBottleIdentityProps } from "@peated/web/lib/bottleListItem";
import { getEntityIdentityProps } from "@peated/web/lib/entityIdentity";
import {
  getFormErrorMessage,
  toChoiceValue,
} from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { WandSparkles } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useDebounceValue } from "usehooks-ts";
import { z } from "zod";

const categoryList = CATEGORY_LIST.map((category) => ({
  id: category,
  name: formatCategoryName(category),
}));

type BooleanChoice = {
  id: "unknown" | "yes" | "no";
  name: string;
};

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

const releaseMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

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

const BottleFormSchema = BottleCreateInputSchema.and(
  z.object({
    imageSourceUrl: ImageSourceUrlSchema,
    imageLicense: ImageLicenseSchema,
  }),
);
type FormSchemaType = z.infer<typeof BottleFormSchema>;
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
  "releaseMonth",
  "releaseDay",
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
  return isNumericChoice(value) ? `Catalog item ${value}` : value.name;
}

function choiceId(value: number | Entity | ChoiceLike) {
  if (isNumericChoice(value)) return String(value);
  return value.id ? String(value.id) : `new:${value.name}`;
}

function toEntityPickerOption(
  value: number | Entity | ChoiceLike | null | undefined,
): EntityPickerOption | null {
  if (value === null || value === undefined) return null;
  return {
    id: choiceId(value),
    ...(isCatalogEntity(value)
      ? getEntityIdentityProps(value)
      : { name: choiceName(value) }),
  };
}

function toSearchPickerOption(
  value: number | Entity | ChoiceLike,
): SearchPickerOption {
  return {
    entity: isCatalogEntity(value)
      ? getEntityIdentityProps(value)
      : { name: choiceName(value) },
    id: choiceId(value),
    label: choiceName(value),
  };
}

function toSeriesPickerOption(
  value: number | ChoiceLike | null | undefined,
  brandName?: string,
): SeriesPickerOption | null {
  if (value === null || value === undefined) return null;
  return {
    id: choiceId(value),
    name: choiceName(value),
    brand: brandName,
  };
}

function entityPickerOption(entity: Entity): EntityPickerOption {
  return {
    id: String(entity.id),
    ...getEntityIdentityProps(entity),
  };
}

function entitySearchOption(entity: Entity): SearchPickerOption {
  return {
    entity: getEntityIdentityProps(entity),
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

function seriesChoiceFromOption(
  option: SeriesPickerOption,
): NonNullable<FormSchemaType["series"]> {
  return option.id.startsWith("new:")
    ? BottleInputFields.series.parse({ name: option.name })!
    : Number(option.id);
}

function makeDraftEntityOption(
  name: string,
  kind: EntityKind,
): EntityPickerOption {
  return {
    id: `new:${name}`,
    kind,
    name,
  };
}

function numberOrNull(value: string) {
  return value ? Number(value) : null;
}

function normalizedPickerQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function identityChoice(option: { id: string | number; name: string }) {
  const id = String(option.id);
  return {
    id: /^\d+$/.test(id) ? Number(id) : null,
    name: option.name,
  };
}

function finiteNumber(value: number | null | undefined) {
  const parsed = z.number().finite().safeParse(value);
  return parsed.success ? parsed.data : null;
}

type BottleCreateCandidateQuery = Inputs["bottles"]["createCandidates"];

const candidateDebounceOptions = {
  equalityFn: (
    left: BottleCreateCandidateQuery,
    right: BottleCreateCandidateQuery,
  ) => JSON.stringify(left) === JSON.stringify(right),
};

const createSteps = [
  "Bottle",
  "Made by",
  "Release",
  "Dates",
  "Production",
  "Cask",
  "Photo",
] as const;

export default function BottleForm({
  initialData,
  mode,
  onSubmit,
  onUseExistingBottle,
  returnTo,
  saveLabel = "Save bottle",
  title,
}: {
  initialData: BottleFormInitialData;
  mode: "create" | "edit";
  onSubmit: (
    value: BottleFormSubmitValue,
    meta: BottleFormSubmitMeta,
  ) => void | Promise<void>;
  onUseExistingBottle?: (bottle: BottleCreateCandidate) => void;
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
  const [seriesQuery, setSeriesQuery] = useState("");
  const [brand, setBrand] = useState<EntityPickerOption | null>(() =>
    toEntityPickerOption(initialData.brand),
  );
  const [bottler, setBottler] = useState<EntityPickerOption | null>(() =>
    toEntityPickerOption(initialData.bottler),
  );
  const [distillers, setDistillers] = useState<readonly SearchPickerOption[]>(
    () => initialData.distillers?.map(toSearchPickerOption) ?? [],
  );
  const [series, setSeries] = useState<SeriesPickerOption | null>(() =>
    toSeriesPickerOption(initialData.series, brand?.name),
  );
  const [image, setImage] = useState<File | null | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState(imageUrl ?? undefined);
  const [currentStep, setCurrentStep] = useState(0);
  const [candidateReviewOpen, setCandidateReviewOpen] = useState(false);
  const [reviewedCandidateIds, setReviewedCandidateIds] = useState<
    ReadonlySet<number>
  >(() => new Set());
  const [candidateReviewResults, setCandidateReviewResults] = useState<
    readonly BottleCreateCandidate[]
  >([]);
  const [submitAfterCandidateReview, setSubmitAfterCandidateReview] =
    useState(false);
  const {
    control,
    formState: { dirtyFields, errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    setValue,
    trigger,
  } = useForm<FormSchemaType>({
    defaultValues: {
      ...initialFormData,
      bottler: toEntityChoiceValue(initialData.bottler),
      brand: toEntityChoiceValue(initialData.brand) ?? undefined,
      distillers: toDistillerChoiceValues(initialData.distillers),
      series: toSeriesChoiceValue(initialData.series),
    },
    resolver: zodResolver(BottleFormSchema),
  });

  const normalizedBrandQuery = normalizedPickerQuery(brandQuery);
  const normalizedBottlerQuery = normalizedPickerQuery(bottlerQuery);
  const normalizedDistillerQuery = normalizedPickerQuery(distillerQuery);
  const normalizedSeriesQuery = normalizedPickerQuery(seriesQuery);
  const [debouncedBrandQuery] = useDebounceValue(normalizedBrandQuery, 150);
  const [debouncedBottlerQuery] = useDebounceValue(normalizedBottlerQuery, 150);
  const [debouncedDistillerQuery] = useDebounceValue(
    normalizedDistillerQuery,
    150,
  );
  const [debouncedSeriesQuery] = useDebounceValue(normalizedSeriesQuery, 150);

  const brandResults = useQuery({
    ...orpc.entities.list.queryOptions({
      input: {
        limit: 25,
        query: debouncedBrandQuery,
        sort: debouncedBrandQuery ? "rank" : "name",
      },
    }),
    staleTime: 5 * 60_000,
  });
  const bottlerResults = useQuery({
    ...orpc.entities.list.queryOptions({
      input: {
        limit: 25,
        query: debouncedBottlerQuery,
        sort: debouncedBottlerQuery ? "rank" : "name",
      },
    }),
    staleTime: 5 * 60_000,
  });
  const distillerResults = useQuery({
    ...orpc.entities.list.queryOptions({
      input: {
        limit: 25,
        query: debouncedDistillerQuery,
        sort: debouncedDistillerQuery ? "rank" : "name",
      },
    }),
    staleTime: 5 * 60_000,
  });
  const numericBrandId = brand && /^\d+$/.test(brand.id) ? Number(brand.id) : 0;
  const seriesPreloadResults = useQuery({
    ...orpc.bottleSeries.list.queryOptions({
      input: {
        brand: numericBrandId,
        limit: 100,
        query: "",
      },
    }),
    enabled: Boolean(numericBrandId),
    staleTime: 5 * 60_000,
  });
  const needsRemoteSeriesSearch =
    (seriesPreloadResults.data?.total ?? 0) >
    (seriesPreloadResults.data?.results.length ?? 0);
  const seriesSearchResults = useQuery({
    ...orpc.bottleSeries.list.queryOptions({
      input: {
        brand: numericBrandId,
        limit: 100,
        query: debouncedSeriesQuery,
      },
    }),
    enabled: Boolean(
      numericBrandId && needsRemoteSeriesSearch && debouncedSeriesQuery,
    ),
    staleTime: 5 * 60_000,
  });
  const seriesResults =
    needsRemoteSeriesSearch && debouncedSeriesQuery
      ? seriesSearchResults
      : seriesPreloadResults;
  const generateData = useMutation(orpc.ai.bottleLookup.mutationOptions());
  const draft = useWatch({ control });
  const {
    abv,
    bottlingYear,
    caskNumber,
    caskStrength,
    category,
    description,
    descriptionSrc,
    edition,
    flavorProfile,
    maltPhenolPpm,
    maturation,
    name,
    naturalColor,
    noAgeStatement,
    nonChillFiltered,
    outturn,
    releaseDay,
    releaseMonth,
    releaseYear,
    singleCask,
    statedAge,
    tastingNotes,
    vintageYear,
  } = draft;
  const candidateInput = useMemo<BottleCreateCandidateQuery>(
    () => ({
      name: name ?? "",
      brand: brand ? identityChoice(brand) : null,
      distillers: distillers.map((distiller) =>
        identityChoice({ id: distiller.id, name: distiller.label }),
      ),
      bottler: bottler ? identityChoice(bottler) : null,
      series: series ? identityChoice(series) : null,
      category: category ?? null,
      statedAge: finiteNumber(statedAge),
      noAgeStatement: noAgeStatement ?? null,
      caskStrength: caskStrength ?? null,
      singleCask: singleCask ?? null,
      naturalColor: naturalColor ?? null,
      nonChillFiltered: nonChillFiltered ?? null,
      maltPhenolPpm: finiteNumber(maltPhenolPpm),
      abv: finiteNumber(abv),
      edition: edition || null,
      vintageYear: finiteNumber(vintageYear),
      bottlingYear: finiteNumber(bottlingYear),
      releaseYear: finiteNumber(releaseYear),
      releaseMonth: finiteNumber(releaseMonth),
      releaseDay: finiteNumber(releaseDay),
      maturation: maturation || null,
      caskNumber: caskNumber || null,
      outturn: finiteNumber(outturn),
      description: description || null,
      descriptionSrc: descriptionSrc ?? null,
      flavorProfile: flavorProfile ?? null,
      tastingNotes: tastingNotes
        ? {
            nose: tastingNotes.nose ?? "",
            palate: tastingNotes.palate ?? "",
            finish: tastingNotes.finish ?? "",
          }
        : null,
      limit: 3,
    }),
    [
      abv,
      bottler,
      bottlingYear,
      brand,
      caskNumber,
      caskStrength,
      category,
      description,
      descriptionSrc,
      distillers,
      edition,
      flavorProfile,
      maltPhenolPpm,
      maturation,
      name,
      naturalColor,
      noAgeStatement,
      nonChillFiltered,
      outturn,
      releaseDay,
      releaseMonth,
      releaseYear,
      series,
      singleCask,
      statedAge,
      tastingNotes,
      vintageYear,
    ],
  );
  const [debouncedCandidateInput] = useDebounceValue(
    candidateInput,
    300,
    candidateDebounceOptions,
  );
  const candidateEnabled = Boolean(
    onUseExistingBottle && brand && debouncedCandidateInput.name.trim(),
  );
  const candidateResults = useQuery({
    ...orpc.bottles.createCandidates.queryOptions({
      input: debouncedCandidateInput,
    }),
    enabled: candidateEnabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const candidateInputPending =
    JSON.stringify(candidateInput) !== JSON.stringify(debouncedCandidateInput);
  const candidateList = candidateResults.data?.results ?? [];
  const candidateCheckLoading = Boolean(
    candidateEnabled && (candidateInputPending || candidateResults.isFetching),
  );
  const unreviewedCandidates = candidateList.filter(
    (candidate) => !reviewedCandidateIds.has(candidate.id),
  );
  const hasUnreviewedCandidates = unreviewedCandidates.length > 0;
  const reviewingCandidates = candidateReviewOpen;
  const isCreate = mode === "create";
  const isLastCreateStep = currentStep === createSteps.length - 1;
  const draftIdentityProps = getBottleIdentityProps({
    name: name || "Bottle preview",
    brand: { name: brand?.name ?? "" },
    category: category ?? null,
    statedAge: statedAge ?? null,
    noAgeStatement: noAgeStatement ?? null,
    abv: abv ?? null,
    edition,
    releaseYear,
  });

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

  function scrollToFormTop() {
    window.scrollTo({ top: 0 });
  }

  function openCandidateReview(submitAfterReview = false) {
    if (!unreviewedCandidates.length) return;
    setCandidateReviewResults(unreviewedCandidates);
    setCandidateReviewOpen(true);
    setSubmitAfterCandidateReview(submitAfterReview);
    scrollToFormTop();
  }

  function closeCandidateReview() {
    setCandidateReviewOpen(false);
    setCandidateReviewResults([]);
    setSubmitAfterCandidateReview(false);
    scrollToFormTop();
  }

  function markCandidateReviewComplete() {
    setReviewedCandidateIds((current) => {
      const next = new Set(current);
      for (const candidate of candidateReviewResults) next.add(candidate.id);
      return next;
    });
  }

  async function continueCreateFlow() {
    const stepFields: ReadonlyArray<ReadonlyArray<BottleFormFieldName>> = [
      ["brand", "name", "category"],
      ["distillers", "bottler", "series"],
      ["statedAge", "noAgeStatement", "abv", "edition"],
      [
        "vintageYear",
        "bottlingYear",
        "releaseYear",
        "releaseMonth",
        "releaseDay",
      ],
      [
        "singleCask",
        "caskStrength",
        "naturalColor",
        "nonChillFiltered",
        "maltPhenolPpm",
      ],
      ["maturation", "caskNumber", "outturn"],
      ["flavorProfile", "imageSourceUrl", "imageLicense", "description"],
    ];
    if (!(await trigger([...stepFields[currentStep]]))) return;
    setCurrentStep((step) => Math.min(step + 1, createSteps.length - 1));
    scrollToFormTop();
  }

  function previousCreateStep(event: FormEvent<HTMLButtonElement>) {
    event.preventDefault();
    setCurrentStep((step) => Math.max(step - 1, 0));
    scrollToFormTop();
  }

  function continueAfterCandidateReview() {
    markCandidateReviewComplete();
    setCandidateReviewOpen(false);
    setCandidateReviewResults([]);
    if (submitAfterCandidateReview) {
      setSubmitAfterCandidateReview(false);
      void handleSubmit(submit)();
    }
  }

  function handlePrimaryAction(
    event: FormEvent<HTMLButtonElement | HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!isCreate) {
      void handleSubmit(submit)(event);
      return;
    }
    if (reviewingCandidates) {
      continueAfterCandidateReview();
      return;
    }
    if (!isLastCreateStep) {
      void continueCreateFlow();
      return;
    }
    if (hasUnreviewedCandidates) {
      openCandidateReview(true);
      return;
    }
    void handleSubmit(submit)(event);
  }

  return (
    <WorkflowScreen
      mobileSaveBar={isCreate}
      onClose={returnTo ? () => window.location.assign(returnTo) : undefined}
      onPrevious={
        reviewingCandidates
          ? (event) => {
              event.preventDefault();
              closeCandidateReview();
            }
          : isCreate && currentStep > 0
            ? previousCreateStep
            : undefined
      }
      onSave={handlePrimaryAction}
      saveDisabled={
        isCreate &&
        !reviewingCandidates &&
        isLastCreateStep &&
        candidateCheckLoading
      }
      saveHint={
        isCreate &&
        !reviewingCandidates &&
        isLastCreateStep &&
        candidateCheckLoading
          ? "Checking existing bottles…"
          : undefined
      }
      saveLabel={
        reviewingCandidates
          ? submitAfterCandidateReview
            ? "Add as a new bottle"
            : "None of these"
          : isCreate && !isLastCreateStep
            ? "Continue"
            : hasUnreviewedCandidates
              ? `Review ${unreviewedCandidates.length} ${
                  unreviewedCandidates.length === 1 ? "bottle" : "bottles"
                }`
              : saveLabel
      }
      saving={isSubmitting}
      title={reviewingCandidates ? "Is it already on Peated?" : title}
    >
      <form onSubmit={handlePrimaryAction}>
        <FormStack>
          {submitError ? (
            <FormNotice role="alert">{submitError}</FormNotice>
          ) : null}
          {reviewingCandidates ? (
            <FormStep key="candidate-review" title="Is it already on Peated?">
              <BottleIdentityRow
                {...draftIdentityProps}
                imageUrl={imagePreview}
                layout="cell"
                variant="search"
                verticalPadding="sm"
              />
              <BottleCreateCandidates
                error={false}
                loading={false}
                onUse={(candidate) => {
                  markCandidateReviewComplete();
                  onUseExistingBottle?.(candidate);
                }}
                results={candidateReviewResults}
              />
            </FormStep>
          ) : (
            <>
              {name || brand ? (
                isCreate ? (
                  <FormDesktopOnly>
                    <BottleIdentityRow
                      {...draftIdentityProps}
                      imageUrl={imagePreview}
                      layout="cell"
                      variant="search"
                      verticalPadding="sm"
                    />
                  </FormDesktopOnly>
                ) : (
                  <BottleIdentityRow
                    {...draftIdentityProps}
                    imageUrl={imagePreview}
                  />
                )
              ) : null}
              {isCreate &&
              onUseExistingBottle &&
              candidateEnabled &&
              candidateResults.isSuccess &&
              hasUnreviewedCandidates ? (
                <BottleCreateCandidateSummary
                  count={unreviewedCandidates.length}
                  loading={candidateCheckLoading}
                  newSinceReview={reviewedCandidateIds.size > 0}
                  onReview={() => openCandidateReview()}
                />
              ) : null}
              {isCreate ? (
                <FormSteps
                  compactOnMobile
                  currentStep={currentStep}
                  steps={createSteps}
                />
              ) : null}
              <BottleFieldsLayout
                create={isCreate}
                currentStep={currentStep}
                defaultOpen={hasMoreDetails(initialData)}
                primary={
                  <>
                    {!isCreate || currentStep === 0 ? (
                      <>
                        <EntityPicker
                          error={errors.brand?.message}
                          help="The main label the bottle is sold under."
                          kind="brand"
                          loading={
                            normalizedBrandQuery !== debouncedBrandQuery ||
                            brandResults.isFetching
                          }
                          onChange={(option) => {
                            setBrand(option);
                            const nextBrand = option
                              ? entityChoiceFromOption(option, "brand")
                              : undefined;
                            // SAFETY: the form can hold an empty required field until schema validation runs.
                            setValue(
                              "brand",
                              nextBrand as FormSchemaType["brand"],
                              {
                                shouldDirty: true,
                                shouldValidate: true,
                              },
                            );
                            setValue("series", null, { shouldDirty: true });
                            setSeries(null);
                            setSeriesQuery("");
                          }}
                          onCreate={(query) => {
                            const option = makeDraftEntityOption(
                              query,
                              "brand",
                            );
                            setBrand(option);
                            setValue(
                              "brand",
                              EntityChoiceSchema.parse({
                                kind: "brand",
                                name: query,
                              }),
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
                          searchError={
                            brandResults.isError
                              ? "Unable to search brands. Keep typing or try again."
                              : undefined
                          }
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
                      </>
                    ) : null}
                    {!isCreate || currentStep === 2 ? (
                      <>
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
                          <Controller
                            control={control}
                            name="noAgeStatement"
                            render={({ field }) => (
                              <Switch
                                checked={field.value === true}
                                description="The label does not state an age."
                                label="No age statement (NAS)"
                                onCheckedChange={(checked) => {
                                  field.onChange(checked ? true : null);
                                  if (checked) {
                                    setValue("statedAge", null, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                  }
                                }}
                              />
                            )}
                          />
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
                      </>
                    ) : null}
                    {!isCreate || currentStep === 1 ? (
                      <>
                        <SearchPicker
                          help="The distilleries that produced the spirit."
                          label="Distilled by"
                          loading={
                            normalizedDistillerQuery !==
                              debouncedDistillerQuery ||
                            distillerResults.isFetching
                          }
                          onChange={(options) => {
                            setDistillers(options);
                            setValue(
                              "distillers",
                              options.map(distillerChoiceFromOption),
                              {
                                shouldDirty: true,
                                shouldValidate: true,
                              },
                            );
                          }}
                          onCreate={(query) => {
                            const option: SearchPickerOption = {
                              entity: { name: query, kind: "distillery" },
                              id: `new:${query}`,
                              label: query,
                            };
                            const next = [...distillers, option];
                            setDistillers(next);
                            setValue(
                              "distillers",
                              next.map(distillerChoiceFromOption),
                              {
                                shouldDirty: true,
                                shouldValidate: true,
                              },
                            );
                          }}
                          onQueryChange={setDistillerQuery}
                          options={(distillerResults.data?.results ?? []).map(
                            entitySearchOption,
                          )}
                          placeholder="Search distilleries"
                          searchError={
                            distillerResults.isError
                              ? "Unable to search distilleries. Keep typing or try again."
                              : undefined
                          }
                          value={distillers}
                        />
                        <EntityPicker
                          help="The independent bottler, if this isn't an official brand or distillery release."
                          kind="bottler"
                          loading={
                            normalizedBottlerQuery !== debouncedBottlerQuery ||
                            bottlerResults.isFetching
                          }
                          onChange={(option) => {
                            setBottler(option);
                            setValue(
                              "bottler",
                              option
                                ? entityChoiceFromOption(option, "bottler")
                                : null,
                              { shouldDirty: true, shouldValidate: true },
                            );
                          }}
                          onCreate={(query) => {
                            const option = makeDraftEntityOption(
                              query,
                              "bottler",
                            );
                            setBottler(option);
                            setValue(
                              "bottler",
                              EntityChoiceSchema.parse({
                                kind: "bottler",
                                name: query,
                              }),
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
                          searchError={
                            bottlerResults.isError
                              ? "Unable to search bottlers. Keep typing or try again."
                              : undefined
                          }
                          value={bottler}
                        />
                      </>
                    ) : null}
                  </>
                }
                secondary={
                  <>
                    {!isCreate || currentStep === 2 ? (
                      <>
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
                      </>
                    ) : null}
                    {!isCreate || currentStep === 1 ? (
                      <SeriesPicker
                        disabled={!brand}
                        error={errors.series?.message}
                        loading={
                          (needsRemoteSeriesSearch &&
                            normalizedSeriesQuery !== debouncedSeriesQuery) ||
                          (Boolean(numericBrandId) && seriesResults.isFetching)
                        }
                        onChange={(option) => {
                          setSeries(option);
                          setValue(
                            "series",
                            option ? seriesChoiceFromOption(option) : null,
                            { shouldDirty: true, shouldValidate: true },
                          );
                        }}
                        onCreate={(query) => {
                          const option = {
                            id: `new:${query}`,
                            name: query,
                            brand: brand?.name,
                          };
                          setSeries(option);
                          setValue("series", seriesChoiceFromOption(option), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        onQueryChange={setSeriesQuery}
                        options={(seriesResults.data?.results ?? []).map(
                          (item) => ({
                            id: String(item.id),
                            name: item.name,
                            brand: brand?.name,
                          }),
                        )}
                        searchError={
                          seriesResults.isError
                            ? "Unable to search Series. Keep typing or try again."
                            : undefined
                        }
                        value={series}
                      />
                    ) : null}
                    {!isCreate || currentStep === 3 ? (
                      <FormGrid compactOnMobile={isCreate}>
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
                          error={errors.releaseMonth?.message}
                          htmlFor="bottle-release-month"
                          label="Release month"
                          optional
                        >
                          <Controller
                            control={control}
                            name="releaseMonth"
                            render={({ field }) => (
                              <Select
                                id="bottle-release-month"
                                invalid={Boolean(errors.releaseMonth)}
                                onChange={(event) =>
                                  field.onChange(
                                    event.currentTarget.value
                                      ? Number(event.currentTarget.value)
                                      : null,
                                  )
                                }
                                value={field.value ?? ""}
                              >
                                <option value="">Not set</option>
                                {releaseMonths.map((month, index) => (
                                  <option key={month} value={index + 1}>
                                    {month}
                                  </option>
                                ))}
                              </Select>
                            )}
                          />
                        </Field>
                        <Field
                          error={errors.releaseDay?.message}
                          htmlFor="bottle-release-day"
                          label="Release day"
                          optional
                        >
                          <TextInput
                            {...register("releaseDay", {
                              setValueAs: (value) => numberOrNull(value),
                            })}
                            format="data"
                            id="bottle-release-day"
                            invalid={Boolean(errors.releaseDay)}
                            max={31}
                            min={1}
                            type="number"
                          />
                        </Field>
                      </FormGrid>
                    ) : null}
                    {!isCreate || currentStep === 4 ? (
                      <>
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
                        <FormGrid compactOnMobile={isCreate}>
                          <BooleanSelectField
                            choices={colorChoices}
                            id="bottle-color"
                            label="Color"
                            onChange={(value) =>
                              setValue("naturalColor", value, {
                                shouldDirty: true,
                              })
                            }
                            value={naturalColor}
                          />
                          <BooleanSelectField
                            choices={filtrationChoices}
                            id="bottle-filtration"
                            label="Filtration"
                            onChange={(value) =>
                              setValue("nonChillFiltered", value, {
                                shouldDirty: true,
                              })
                            }
                            value={nonChillFiltered}
                          />
                        </FormGrid>
                        <Field
                          error={errors.maltPhenolPpm?.message}
                          hint="The label may show a PPM number for the malted barley."
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
                      </>
                    ) : null}
                    {!isCreate || currentStep === 5 ? (
                      <>
                        <Field
                          error={errors.maturation?.message}
                          hint="Copy the producer's wording from the label."
                          htmlFor="bottle-maturation"
                          label="Cask details"
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
                        <FormGrid compactOnMobile={isCreate}>
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
                            label="Number of bottles"
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
                      </>
                    ) : null}
                    {!isCreate || currentStep === 6 ? (
                      <>
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
                        <FieldGroup label="Bottle image" optional>
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
                              setValue("imageSourceUrl", null, {
                                shouldDirty: true,
                              });
                              setValue("imageLicense", null, {
                                shouldDirty: true,
                              });
                            }}
                            onRemove={
                              imagePreview
                                ? () => {
                                    setImage(null);
                                    setImagePreview(undefined);
                                    setValue("imageSourceUrl", null, {
                                      shouldDirty: true,
                                    });
                                    setValue("imageLicense", null, {
                                      shouldDirty: true,
                                    });
                                  }
                                : undefined
                            }
                            preview={
                              imagePreview
                                ? {
                                    alt: "Current bottle image",
                                    src: imagePreview,
                                  }
                                : undefined
                            }
                          />
                          {user?.mod || user?.admin ? (
                            <>
                              <Field
                                error={errors.imageSourceUrl?.message}
                                htmlFor="bottle-image-source"
                                label="Source URL"
                                optional
                              >
                                <TextInput
                                  {...register("imageSourceUrl", {
                                    setValueAs: (value) => value || null,
                                  })}
                                  id="bottle-image-source"
                                  invalid={Boolean(errors.imageSourceUrl)}
                                  placeholder="https://example.com/original-image"
                                  type="url"
                                />
                              </Field>
                              <Field
                                error={errors.imageLicense?.message}
                                htmlFor="bottle-image-license"
                                label="License"
                                optional
                              >
                                <TextInput
                                  {...register("imageLicense", {
                                    setValueAs: (value) => value || null,
                                  })}
                                  id="bottle-image-license"
                                  invalid={Boolean(errors.imageLicense)}
                                  placeholder="CC BY-SA 4.0"
                                />
                              </Field>
                            </>
                          ) : null}
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
                                setValue("descriptionSrc", "user", {
                                  shouldDirty: true,
                                }),
                              setValueAs: (value) => value || null,
                            })}
                            id="bottle-description"
                            invalid={Boolean(errors.description)}
                            rows={isCreate ? 4 : 8}
                          />
                        </Field>
                      </>
                    ) : null}
                  </>
                }
              />
            </>
          )}
        </FormStack>
      </form>
    </WorkflowScreen>
  );
}

function BottleFieldsLayout({
  create,
  currentStep,
  defaultOpen,
  primary,
  secondary,
}: {
  create: boolean;
  currentStep: number;
  defaultOpen: boolean;
  primary: ReactNode;
  secondary: ReactNode;
}) {
  if (create) {
    const title = createSteps[currentStep] ?? createSteps[0];
    return (
      <FormStep key={title} title={title}>
        {primary}
        {secondary}
      </FormStep>
    );
  }

  return (
    <>
      <FormSection title="Bottle details">{primary}</FormSection>
      <FormDetails
        defaultOpen={defaultOpen}
        description="Edition, year, cask, production, and catalog information."
        title="More details"
      >
        {secondary}
      </FormDetails>
    </>
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
