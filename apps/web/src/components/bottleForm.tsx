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
import { toTitleCase } from "@peated/server/lib/strings";
import { BottleInputSchema } from "@peated/server/schemas";
import type { Entity, FlavorProfile } from "@peated/server/types";
import { PreviewBottleCard } from "@peated/web/components/bottleCard";
import EntityField from "@peated/web/components/entityField";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormScreen from "@peated/web/components/formScreen";
import ImageField from "@peated/web/components/imageField";
import type { Option } from "@peated/web/components/selectField";
import SelectField from "@peated/web/components/selectField";
import SeriesField from "@peated/web/components/seriesField";
import TextField from "@peated/web/components/textField";
import config from "@peated/web/config";
import useAuth from "@peated/web/hooks/useAuth";
import {
  getFormErrorMessage,
  toChoiceValue,
  toOption,
  toOptionList,
} from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
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

type FormSchemaType = z.infer<typeof BottleInputSchema>;
type ChoiceLike = {
  id?: number | null;
  name?: string | null;
};
export type BottleFormInitialData = Partial<
  Omit<FormSchemaType, "brand" | "distillers" | "bottler" | "series" | "image">
> & {
  brand?: number | Entity | ChoiceLike | null;
  distillers?: Array<number | Entity | ChoiceLike>;
  bottler?: number | Entity | ChoiceLike | null;
  series?: number | ChoiceLike | null;
  imageUrl?: string | null;
  numReleases?: number | null;
};

const toEntityChoiceValue = (
  value: number | Entity | ChoiceLike | null | undefined,
): FormSchemaType["brand"] | FormSchemaType["bottler"] =>
  toChoiceValue(value) as FormSchemaType["brand"] | FormSchemaType["bottler"];

const toSeriesChoiceValue = (
  value: number | ChoiceLike | null | undefined,
): FormSchemaType["series"] => toChoiceValue(value) as FormSchemaType["series"];

const toDistillerChoiceValues = (
  values: Array<number | Entity | ChoiceLike> | null | undefined,
): NonNullable<FormSchemaType["distillers"]> =>
  (values
    ?.map((value) => toChoiceValue(value))
    .filter(
      (value): value is NonNullable<FormSchemaType["distillers"]>[number] =>
        value != null,
    ) as NonNullable<FormSchemaType["distillers"]>) ?? [];

export default function BottleForm({
  onSubmit,
  initialData,
  title,
  returnTo,
  showBottleReleaseDetails = false,
}: {
  onSubmit: SubmitHandler<
    Omit<FormSchemaType, "image"> & {
      image: HTMLCanvasElement | null | undefined;
    }
  >;
  initialData: BottleFormInitialData;
  title: string;
  returnTo?: string | null;
  showBottleReleaseDetails?: boolean;
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
      bottler: toEntityChoiceValue(initialData.bottler),
      brand: toEntityChoiceValue(initialData.brand) ?? undefined,
      distillers: toDistillerChoiceValues(initialData.distillers),
      series: toSeriesChoiceValue(initialData.series),
    },
  });

  const [error, setError] = useState<string | undefined>();
  const [image, setImage] = useState<HTMLCanvasElement | null | undefined>(
    undefined,
  );
  const router = useRouter();
  const orpc = useORPC();
  const { user } = useAuth();
  const canUseBottleLookup = !!(user?.mod || user?.admin);

  const generateDataMutation = useMutation(
    orpc.ai.bottleLookup.mutationOptions(),
  );

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      await onSubmit({ image, ...data });
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

  return (
    <FormScreen
      title={title}
      saveDisabled={isSubmitting}
      onSave={handleSubmit(onSubmitHandler)}
      onClose={() => (returnTo ? router.push(returnTo) : router.back())}
    >
      <div className="border-slate-700 p-4 lg:mb-8 lg:border">
        <div className="prose prose-invert text-muted max-w-full text-sm leading-6">
          <p>
            It can be tricky to find the right information, so if you&apos;re
            struggling, just try to fill in the components that you're confident
            about. The brand will almost always have multiple bottles (e.g.{" "}
            <em>Hibiki</em>), and the bottle name, if nothing else, you can use
            the full bottle label.
          </p>
          <p>
            Keep this form focused on the core bottle. If you care about a
            specific batch, single cask, or other exact bottling, you can track
            that later from the bottle page or when recording a tasting.
          </p>
          <p>
            Have any suggestions for making it easier to enter correct data?{" "}
            <a href={config.GITHUB_REPO}>Open an Issue on GitHub</a> or{" "}
            <a href={config.DISCORD_LINK}>drop a note on Discord</a> if you have
            feedback. We'll update the bottle preview as you enter information.
          </p>
        </div>
      </div>

      <div className="lg:mb-8 lg:p-0">
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
            label="Bottle"
            required
            helpText={
              <div className="flex flex-col gap-y-2">
                <p>
                  The name of the expression. We'll do our best to clean this up
                  for you, but generally speaking there's a few things to think
                  about:
                </p>
                <ul className="ml-6 flex list-disc flex-col gap-y-1">
                  <li>
                    The unique expression name is the focus. For example,{" "}
                    <strong>do not</strong> include the series if applicable,
                    like <em>A Midwinter NIght's Dram</em>.
                  </li>
                  <li>
                    Edition names should not be included. For example,{" "}
                    <strong>do not include</strong> <em>2010 Spring Release</em>
                    .
                  </li>
                  <li>
                    Flavor text should be avoided whenever possible. For
                    example, <strong>Do not include</strong>{" "}
                    <em>Scotch Malt Whisky</em>.
                  </li>
                  <li>
                    If there is no other identifying series information use core
                    data. For example, <em>10-year-old Single Malt</em>...
                  </li>
                  <li>
                    However, if the expression is clearly identifying,{" "}
                    <em>do not include</em> the stated age or the spirit type.
                  </li>
                </ul>
              </div>
            }
            placeholder="e.g. 12-year-old"
          />

          <Controller
            name="series"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SeriesField
                {...field}
                error={errors.series}
                label="Series"
                helpText="The series this bottle belongs to (if any)."
                placeholder="e.g. A Midwinter Night's Dram"
                brand={brandValue?.id ? Number(brandValue.id) : 0}
                disabled={!brandValue}
                canCreate
                onChange={(value) => {
                  onChange(value?.id || value);
                  setSeriesValue(value);
                }}
                value={seriesValue}
              />
            )}
          />
        </Fieldset>
        <Fieldset>
          <TextField
            {...register("statedAge", {
              setValueAs: (v) => (v === "" || !v ? null : parseInt(v, 10)),
            })}
            error={errors.statedAge}
            type="number"
            label="Stated Age"
            placeholder="e.g. 12"
            helpText="The number of years the spirit was aged, as stated on the bottle."
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
                  brand: brandValue?.id ? Number(brandValue.id) : null,
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
                  brand: brandValue?.id ? Number(brandValue.id) : null,
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

        {showBottleReleaseDetails && (
          <Fieldset>
            <div className="text-muted text-sm leading-6">
              {initialData.numReleases ? (
                <p>
                  This bottle already has tracked bottlings. These parent-level
                  fields should usually be cleared before splitting legacy data
                  into child bottlings.
                </p>
              ) : (
                <p>
                  Use these only when the bottle itself is the exact marketed
                  release and there is no reusable child bottling yet.
                </p>
              )}
            </div>

            <TextField
              {...register("edition")}
              error={errors.edition}
              type="text"
              label="Edition / Label"
              helpText="Optional bottle-level release label when this bottle is itself the specific marketed release."
              placeholder="e.g. Batch 24, 1990 Release"
            />

            <TextField
              {...register("abv", {
                setValueAs: (v) => (v === "" || !v ? null : parseFloat(v)),
              })}
              error={errors.abv}
              type="number"
              label="ABV"
              placeholder="e.g. 40.5"
              helpText="Bottle-level ABV only when it belongs to the bottle identity or no child bottlings exist yet."
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
              placeholder="e.g. 1990"
              helpText="Bottle-level release year only when there is not a reusable child bottling yet."
            />

            <TextField
              {...register("vintageYear", {
                setValueAs: (v) => (v === "" || !v ? null : parseInt(v, 10)),
              })}
              error={errors.vintageYear}
              type="number"
              label="Vintage Year"
              placeholder="e.g. 1986"
              helpText="Bottle-level vintage year only when it belongs to the bottle identity or no child bottlings exist yet."
            />

            <BooleanField
              control={control}
              label="Single Cask"
              helpText="Whether the bottle itself is explicitly a single-cask release."
              name="singleCask"
            />

            <BooleanField
              control={control}
              label="Cask Strength"
              helpText="Whether the bottle itself is explicitly bottled at cask strength."
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
          </Fieldset>
        )}

        <Fieldset>
          <div className="flex items-center justify-between gap-4">
            <div className="font-medium">Additional Details</div>
            {canUseBottleLookup && (
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
          </div>

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
                  const classes = classesForProfile(option.id as FlavorProfile);
                  return (
                    <div className="flex flex-col items-start justify-start gap-y-2 text-left">
                      <h4
                        className={`${classes.bg} ${classes.bgHover} rounded px-2 py-1`}
                      >
                        {option.name}
                      </h4>
                      <div className="text-muted text-sm font-normal">
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

          <ImageField
            name="image"
            label="Image"
            value={initialData.imageUrl}
            onChange={(value) => setImage(value)}
            noEditor
          />

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
        </Fieldset>
      </Form>
    </FormScreen>
  );
}
