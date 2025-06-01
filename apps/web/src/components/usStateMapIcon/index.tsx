import type { ComponentPropsWithoutRef } from "react";

import UsStateAlabamaMap from "./assets/alabama.svg";
import UsStateAlaskaMap from "./assets/alaska.svg";
import UsStateArizonaMap from "./assets/arizona.svg";
import UsStateArkansasMap from "./assets/arkansas.svg";
import UsStateCaliforniaMap from "./assets/california.svg";
import UsStateColoradoMap from "./assets/colorado.svg";
import UsStateConnecticutMap from "./assets/connecticut.svg";
import UsStateDelawareMap from "./assets/delaware.svg";
import UsStateFloridaMap from "./assets/florida.svg";
import UsStateGeorgiaMap from "./assets/georgia.svg";
import UsStateHawaiiMap from "./assets/hawaii.svg";
import UsStateIdahoMap from "./assets/idaho.svg";
import UsStateIllinoisMap from "./assets/illinois.svg";
import UsStateIndianaMap from "./assets/indiana.svg";
import UsStateIowaMap from "./assets/iowa.svg";
import UsStateKansasMap from "./assets/kansas.svg";
import UsStateKentuckyMap from "./assets/kentucky.svg";
import UsStateLouisianaMap from "./assets/louisiana.svg";
import UsStateMaineMap from "./assets/maine.svg";
import UsStateMarylandMap from "./assets/maryland.svg";
import UsStateMassachusettsMap from "./assets/massachusetts.svg";
import UsStateMichiganMap from "./assets/michigan.svg";
import UsStateMinnesotaMap from "./assets/minnesota.svg";
import UsStateMississippiMap from "./assets/mississippi.svg";
import UsStateMissouriMap from "./assets/missouri.svg";
import UsStateMontanaMap from "./assets/montana.svg";
import UsStateNebraskaMap from "./assets/nebraska.svg";
import UsStateNevadaMap from "./assets/nevada.svg";
import UsStateNewHampshireMap from "./assets/new-hampshire.svg";
import UsStateNewJerseyMap from "./assets/new-jersey.svg";
import UsStateNewMexicoMap from "./assets/new-mexico.svg";
import UsStateNewYorkMap from "./assets/new-york.svg";
import UsStateNorthCarolinaMap from "./assets/north-carolina.svg";
import UsStateNorthDakotaMap from "./assets/north-dakota.svg";
import UsStateOhioMap from "./assets/ohio.svg";
import UsStateOklahomaMap from "./assets/oklahoma.svg";
import UsStateOregonMap from "./assets/oregon.svg";
import UsStatePennsylvaniaMap from "./assets/pennsylvania.svg";
import UsStateRhodeIslandMap from "./assets/rhode-island.svg";
import UsStateSouthCarolinaMap from "./assets/south-carolina.svg";
import UsStateSouthDakotaMap from "./assets/south-dakota.svg";
import UsStateTennesseeMap from "./assets/tennessee.svg";
import UsStateTexasMap from "./assets/texas.svg";
import UsStateUtahMap from "./assets/utah.svg";
import UsStateVermontMap from "./assets/vermont.svg";
import UsStateVirginiaMap from "./assets/virginia.svg";
import UsStateWashingtonMap from "./assets/washington.svg";
import UsStateWestVirginiaMap from "./assets/west-virginia.svg";
import UsStateWisconsinMap from "./assets/wisconsin.svg";
import UsStateWyomingMap from "./assets/wyoming.svg";

export default function UsStateMapIcon({
  slug,
  ...props
}: ComponentPropsWithoutRef<"svg"> & { slug: string }) {
  switch (slug) {
    case "connecticut":
      return <UsStateConnecticutMap {...props} />;
    case "new-mexico":
      return <UsStateNewMexicoMap {...props} />;
    case "wisconsin":
      return <UsStateWisconsinMap {...props} />;
    case "arkansas":
      return <UsStateArkansasMap {...props} />;
    case "utah":
      return <UsStateUtahMap {...props} />;
    case "virginia":
      return <UsStateVirginiaMap {...props} />;
    case "iowa":
      return <UsStateIowaMap {...props} />;
    case "ohio":
      return <UsStateOhioMap {...props} />;
    case "massachusetts":
      return <UsStateMassachusettsMap {...props} />;
    case "oklahoma":
      return <UsStateOklahomaMap {...props} />;
    case "west-virginia":
      return <UsStateWestVirginiaMap {...props} />;
    case "louisiana":
      return <UsStateLouisianaMap {...props} />;
    case "nebraska":
      return <UsStateNebraskaMap {...props} />;
    case "minnesota":
      return <UsStateMinnesotaMap {...props} />;
    case "colorado":
      return <UsStateColoradoMap {...props} />;
    case "michigan":
      return <UsStateMichiganMap {...props} />;
    case "vermont":
      return <UsStateVermontMap {...props} />;
    case "washington":
      return <UsStateWashingtonMap {...props} />;
    case "arizona":
      return <UsStateArizonaMap {...props} />;
    case "pennsylvania":
      return <UsStatePennsylvaniaMap {...props} />;
    case "illinois":
      return <UsStateIllinoisMap {...props} />;
    case "new-york":
      return <UsStateNewYorkMap {...props} />;
    case "kentucky":
      return <UsStateKentuckyMap {...props} />;
    case "maine":
      return <UsStateMaineMap {...props} />;
    case "north-dakota":
      return <UsStateNorthDakotaMap {...props} />;
    case "georgia":
      return <UsStateGeorgiaMap {...props} />;
    case "hawaii":
      return <UsStateHawaiiMap {...props} />;
    case "north-carolina":
      return <UsStateNorthCarolinaMap {...props} />;
    case "new-jersey":
      return <UsStateNewJerseyMap {...props} />;
    case "texas":
      return <UsStateTexasMap {...props} />;
    case "delaware":
      return <UsStateDelawareMap {...props} />;
    case "alabama":
      return <UsStateAlabamaMap {...props} />;
    case "kansas":
      return <UsStateKansasMap {...props} />;
    case "tennessee":
      return <UsStateTennesseeMap {...props} />;
    case "oregon":
      return <UsStateOregonMap {...props} />;
    case "missouri":
      return <UsStateMissouriMap {...props} />;
    case "nevada":
      return <UsStateNevadaMap {...props} />;
    case "south-dakota":
      return <UsStateSouthDakotaMap {...props} />;
    case "idaho":
      return <UsStateIdahoMap {...props} />;
    case "wyoming":
      return <UsStateWyomingMap {...props} />;
    case "rhode-island":
      return <UsStateRhodeIslandMap {...props} />;
    case "new-hampshire":
      return <UsStateNewHampshireMap {...props} />;
    case "south-carolina":
      return <UsStateSouthCarolinaMap {...props} />;
    case "mississippi":
      return <UsStateMississippiMap {...props} />;
    case "montana":
      return <UsStateMontanaMap {...props} />;
    case "california":
      return <UsStateCaliforniaMap {...props} />;
    case "florida":
      return <UsStateFloridaMap {...props} />;
    case "indiana":
      return <UsStateIndianaMap {...props} />;
    case "alaska":
      return <UsStateAlaskaMap {...props} />;
    case "maryland":
      return <UsStateMarylandMap {...props} />;
    default:
      return null;
  }
}
