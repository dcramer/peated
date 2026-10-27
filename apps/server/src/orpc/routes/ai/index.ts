import { base } from "../..";
import countryLookup from "./country-lookup";
import entityLookup from "./entity-lookup";
import regionLookup from "./region-lookup";

export default base.tag("ai").router({
  countryLookup,
  entityLookup,
  regionLookup,
});
