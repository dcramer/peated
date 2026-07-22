import type { ConcreteBottleUpdateInput } from "@peated/server/lib/concreteBottleSchemas";
import type {
  BottleFormSubmitMeta,
  BottleFormSubmitValue,
} from "@peated/web/components/bottleForm";

type SharedPatch = NonNullable<ConcreteBottleUpdateInput["shared"]>;
type ExactPatch = NonNullable<ConcreteBottleUpdateInput["exact"]>;

/**
 * Partitions only dirty fields rendered by the live form into sparse
 * shared/exact patches. The two stated-age controls preserve their distinct
 * shared and Bottle-specific ownership; non-rendered tasting notes stay untouched.
 */
export function buildConcreteBottleUpdateInput(
  value: BottleFormSubmitValue,
  { dirtyFields }: BottleFormSubmitMeta,
): ConcreteBottleUpdateInput {
  const shared: SharedPatch = {};
  const exact: ExactPatch = {};

  if (dirtyFields.has("name")) shared.name = value.name;
  if (dirtyFields.has("statedAge")) shared.statedAge = value.statedAge;
  if (dirtyFields.has("series")) shared.series = value.series;
  if (dirtyFields.has("category")) shared.category = value.category;
  if (dirtyFields.has("brand")) shared.brand = value.brand;
  if (dirtyFields.has("distillers")) shared.distillers = value.distillers;
  if (dirtyFields.has("bottler")) shared.bottler = value.bottler;
  if (dirtyFields.has("flavorProfile")) {
    shared.flavorProfile = value.flavorProfile;
  }

  if (dirtyFields.has("edition")) exact.edition = value.edition;
  if (dirtyFields.has("exactStatedAge")) {
    exact.statedAge = value.exactStatedAge ?? null;
  }
  if (dirtyFields.has("abv")) exact.abv = value.abv;
  if (dirtyFields.has("singleCask")) exact.singleCask = value.singleCask;
  if (dirtyFields.has("caskStrength")) {
    exact.caskStrength = value.caskStrength;
  }
  if (dirtyFields.has("vintageYear")) exact.vintageYear = value.vintageYear;
  if (dirtyFields.has("releaseYear")) exact.releaseYear = value.releaseYear;
  if (dirtyFields.has("caskSize")) exact.caskSize = value.caskSize;
  if (dirtyFields.has("caskType")) exact.caskType = value.caskType;
  if (dirtyFields.has("caskFill")) exact.caskFill = value.caskFill;
  if (dirtyFields.has("description")) {
    exact.description = value.description;
    exact.descriptionSrc = value.descriptionSrc ?? null;
  } else if (dirtyFields.has("descriptionSrc")) {
    exact.descriptionSrc = value.descriptionSrc ?? null;
  }
  if (value.image === null) exact.image = null;

  return {
    ...(Object.keys(shared).length > 0 ? { shared } : {}),
    ...(Object.keys(exact).length > 0 ? { exact } : {}),
  };
}
