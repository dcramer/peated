import type { BottlePatch } from "@peated/server/lib/bottleSchemas";
import type {
  BottleFormSubmitMeta,
  BottleFormSubmitValue,
} from "@peated/web/components/bottleForm";

/** Builds a sparse flat patch from fields changed in the Bottle form. */
export function buildBottlePatch(
  value: BottleFormSubmitValue,
  { dirtyFields }: BottleFormSubmitMeta,
): BottlePatch {
  const patch: BottlePatch = {};

  if (dirtyFields.has("name")) patch.name = value.name;
  if (dirtyFields.has("statedAge")) patch.statedAge = value.statedAge;
  if (dirtyFields.has("noAgeStatement")) {
    patch.noAgeStatement = value.noAgeStatement;
  }
  if (dirtyFields.has("series")) patch.series = value.series;
  if (dirtyFields.has("category")) patch.category = value.category;
  if (dirtyFields.has("brand")) patch.brand = value.brand;
  if (dirtyFields.has("distillers")) patch.distillers = value.distillers;
  if (dirtyFields.has("bottler")) patch.bottler = value.bottler;
  if (dirtyFields.has("flavorProfile")) {
    patch.flavorProfile = value.flavorProfile;
  }

  if (dirtyFields.has("edition")) patch.edition = value.edition;
  if (dirtyFields.has("abv")) patch.abv = value.abv;
  if (dirtyFields.has("singleCask")) patch.singleCask = value.singleCask;
  if (dirtyFields.has("caskStrength")) {
    patch.caskStrength = value.caskStrength;
  }
  if (dirtyFields.has("naturalColor")) {
    patch.naturalColor = value.naturalColor;
  }
  if (dirtyFields.has("nonChillFiltered")) {
    patch.nonChillFiltered = value.nonChillFiltered;
  }
  if (dirtyFields.has("maltPhenolPpm")) {
    patch.maltPhenolPpm = value.maltPhenolPpm;
  }
  if (dirtyFields.has("vintageYear")) patch.vintageYear = value.vintageYear;
  if (dirtyFields.has("bottlingYear")) {
    patch.bottlingYear = value.bottlingYear;
  }
  if (dirtyFields.has("releaseYear")) patch.releaseYear = value.releaseYear;
  if (dirtyFields.has("releaseDate")) patch.releaseDate = value.releaseDate;
  if (dirtyFields.has("caskSize")) patch.caskSize = value.caskSize;
  if (dirtyFields.has("caskType")) patch.caskType = value.caskType;
  if (dirtyFields.has("caskFill")) patch.caskFill = value.caskFill;
  if (dirtyFields.has("description")) {
    patch.description = value.description;
    patch.descriptionSrc = value.descriptionSrc ?? null;
  } else if (dirtyFields.has("descriptionSrc")) {
    patch.descriptionSrc = value.descriptionSrc ?? null;
  }
  if (value.image === null) patch.image = null;

  return patch;
}
