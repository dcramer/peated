import { base } from "../..";
import bottleLookup from "./bottle-lookup";
import countryLookup from "./country-lookup";
import entityLookup from "./entity-lookup";
import labelExtract from "./label-extract";
import regionLookup from "./region-lookup";

export default base.tag("ai").router({
  bottleLookup,
  countryLookup,
  entityLookup,
  labelExtract,
  regionLookup,
});
