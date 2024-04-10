import { zodResolver } from "@hookform/resolvers/zod";
import { FLAVOR_PROFILES, SERVING_STYLE_LIST } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import { TastingInputSchema } from "@peated/server/schemas";
import type {
  FlavorProfile,
  Paginated,
  ServingStyle,
  Tag,
  Tasting,
  User,
} from "@peated/server/types";
import BottleCard from "@peated/web/components/bottleCard";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import ImageField from "@peated/web/components/imageField";
import Layout from "@peated/web/components/layout";
import RangeField from "@peated/web/components/rangeField";
import type { Option } from "@peated/web/components/selectField";
import SelectField from "@peated/web/components/selectField";
import Spinner from "@peated/web/components/spinner";
import TextAreaField from "@peated/web/components/textAreaField";
import { logError } from "@peated/web/lib/log";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { formatFlavorProfile } from "../../../server/src/lib/format";
import { isTRPCClientError, trpc } from "../lib/trpc";
import { classesForProfile } from "./flavorProfile";
import Form from "./form";

type FormSchemaType = z.infer<typeof TastingInputSchema>;

function formatServingStyle(style: ServingStyle) {
  return toTitleCase(style);
}

function notesForProfile(profile: FlavorProfile): string {
  switch (profile) {
    case "young_spritely":
      return "Vibrant and youthful, bursting with lively essence and energy.";
    case "sweet_fruit_mellow":
      return "Defined by sweet and fruity undertones, often presenting a smooth and mellow disposition.";
    case "spicy_sweet":
      return "Balancing the interplay of spiciness and sweetness for a dynamic sensory experience.";
    case "spicy_dry":
      return "Prioritizing spicier and peppery tones within its profile.";
    case "deep_rich_dried_fruit":
      return "Delving into deep, rich essences reminiscent of dried fruits with a robust sweetness.";
    case "old_dignified":
      return "Typically older, showcasing mature and complex nuances.";
    case "light_delicate":
      return "Characterized by gentle essences and a delicate touch.";
    case "juicy_oak_vanilla":
      return "Revealing notes of fruitiness combined with distinct characters of oak and vanilla.";
    case "oily_coastal":
      return "Reflecting maritime influences, often marked by an oily texture.";
    case "lightly_peated":
      return "With a discreet presence of peat smoke, gently accentuating the spectrum without overwhelming.";
    case "peated":
      return "Where the influence of peat smoke is noticeable, offering more intensity than its lightly peated counterparts.";
    case "heavily_peated":
      return "Bold and dominant with peat smoke character, standing at the forefront of its essence.";
    default:
      return "";
  }
}

const servingStyleList = SERVING_STYLE_LIST.map((c) => ({
  id: c,
  name: formatServingStyle(c),
}));

const flavorProfileList = FLAVOR_PROFILES.map((c) => ({
  id: c,
  name: formatFlavorProfile(c),
}));

const userToOption = (user: User): Option => {
  return {
    id: user.id,
    name: user.username,
  };
};

export default function TastingForm({
  onSubmit,
  initialData,
  title,
  suggestedTags,
}: {
  onSubmit: SubmitHandler<
    FormSchemaType & {
      picture: HTMLCanvasElement | null;
    }
  >;
  initialData: Partial<Tasting> & Pick<Tasting, "bottle">;
  title: string;
  suggestedTags: Paginated<Tag>;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(TastingInputSchema),
    defaultValues: {
      bottle: initialData.bottle.id,
      rating: initialData.rating,
      notes: initialData.notes,
      tags: initialData.tags,
      flavorProfile: initialData.flavorProfile,
      servingStyle: initialData.servingStyle,
      friends: initialData.friends ? initialData.friends.map((d) => d.id) : [],
    },
  });

  const [error, setError] = useState<string | undefined>();
  const [picture, setPicture] = useState<HTMLCanvasElement | null>(null);
  const [friendsValue, setFriendsValue] = useState<Option[]>(
    initialData.friends ? initialData.friends.map(userToOption) : [],
  );

  const trpcUtils = trpc.useUtils();

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      await onSubmit({ ...data, picture });
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
            onSave={handleSubmit(onSubmitHandler)}
            saveDisabled={isSubmitting}
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

      <Form onSubmit={handleSubmit(onSubmitHandler)}>
        {error && <FormError values={[error]} />}

        <div className="sm:mb-4">
          <BottleCard bottle={initialData.bottle} color="highlight" />
        </div>

        <Fieldset>
          <Controller
            name="rating"
            control={control}
            render={({ field: { ref, onChange, ...field } }) => (
              <RangeField
                {...field}
                onChange={(e) =>
                  onChange(
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
                error={errors.rating}
                label="Rating"
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
                  const classes = classesForProfile(option.id as FlavorProfile);
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

          <Controller
            name="tags"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                error={errors.tags}
                label="Notes"
                targetOptions={5}
                options={suggestedTags.results.map((t) => ({
                  id: t.tag,
                  name: toTitleCase(t.tag),
                  count: t.count,
                }))}
                onChange={(value) => onChange(value.map((t: any) => t.id))}
                value={value?.map((t) => ({
                  id: t,
                  name: toTitleCase(t),
                }))}
                multiple
              />
            )}
          />

          <TextAreaField
            {...register("notes")}
            error={errors.notes}
            label="Comments"
            placeholder="Tell us how you really feel."
          />

          <ImageField
            name="image"
            label="Picture"
            onChange={(value) => setPicture(value)}
            imageWidth={1024 / 2}
            imageHeight={768 / 2}
          />

          <Controller
            name="servingStyle"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                error={errors.servingStyle}
                label="Serving Style"
                targetOptions={servingStyleList.length}
                options={servingStyleList}
                onChange={(value) => onChange(value?.id)}
                value={
                  value
                    ? {
                        id: value,
                        name: formatServingStyle(value),
                      }
                    : undefined
                }
              />
            )}
          />

          <Controller
            name="friends"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                onQuery={async (query) => {
                  const { results } = await trpcUtils.friendList.fetch({
                    query,
                    filter: "active",
                  });
                  return results.map((d) => ({
                    id: d.user.id,
                    name: d.user.username,
                  }));
                }}
                multiple
                error={errors.friends}
                label="Friends"
                helpText="The people you're enjoying this tasting with."
                placeholder="e.g. Bob Dylan"
                onChange={(value) => {
                  onChange(value.map((t: any) => t.id || t));
                  setFriendsValue(value);
                }}
                value={friendsValue}
              />
            )}
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
