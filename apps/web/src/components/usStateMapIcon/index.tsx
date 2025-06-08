import type { ComponentPropsWithoutRef } from "react";

import UsStateAlabamaMap from "./assets/alabama.svg?react";
import UsStateAlaskaMap from "./assets/alaska.svg?react";
import UsStateArizonaMap from "./assets/arizona.svg?react";
import UsStateArkansasMap from "./assets/arkansas.svg?react";
import UsStateCaliforniaMap from "./assets/california.svg?react";
import UsStateColoradoMap from "./assets/colorado.svg?react";
import UsStateConnecticutMap from "./assets/connecticut.svg?react";
import UsStateDelawareMap from "./assets/delaware.svg?react";
import UsStateFloridaMap from "./assets/florida.svg?react";
import UsStateGeorgiaMap from "./assets/georgia.svg?react";
import UsStateHawaiiMap from "./assets/hawaii.svg?react";
import UsStateIdahoMap from "./assets/idaho.svg?react";
import UsStateIllinoisMap from "./assets/illinois.svg?react";
import UsStateIndianaMap from "./assets/indiana.svg?react";
import UsStateIowaMap from "./assets/iowa.svg?react";
import UsStateKansasMap from "./assets/kansas.svg?react";
import UsStateKentuckyMap from "./assets/kentucky.svg?react";
import UsStateLouisianaMap from "./assets/louisiana.svg?react";
import UsStateMaineMap from "./assets/maine.svg?react";
import UsStateMarylandMap from "./assets/maryland.svg?react";
import UsStateMassachusettsMap from "./assets/massachusetts.svg?react";
import UsStateMichiganMap from "./assets/michigan.svg?react";
import UsStateMinnesotaMap from "./assets/minnesota.svg?react";
import UsStateMississippiMap from "./assets/mississippi.svg?react";
import UsStateMissouriMap from "./assets/missouri.svg?react";
import UsStateMontanaMap from "./assets/montana.svg?react";
import UsStateNebraskaMap from "./assets/nebraska.svg?react";
import UsStateNevadaMap from "./assets/nevada.svg?react";
import UsStateNewHampshireMap from "./assets/new-hampshire.svg?react";
import UsStateNewJerseyMap from "./assets/new-jersey.svg?react";
import UsStateNewMexicoMap from "./assets/new-mexico.svg?react";
import UsStateNewYorkMap from "./assets/new-york.svg?react";
import UsStateNorthCarolinaMap from "./assets/north-carolina.svg?react";
import UsStateNorthDakotaMap from "./assets/north-dakota.svg?react";
import UsStateOhioMap from "./assets/ohio.svg?react";
import UsStateOklahomaMap from "./assets/oklahoma.svg?react";
import UsStateOregonMap from "./assets/oregon.svg?react";
import UsStatePennsylvaniaMap from "./assets/pennsylvania.svg?react";
import UsStateRhodeIslandMap from "./assets/rhode-island.svg?react";
import UsStateSouthCarolinaMap from "./assets/south-carolina.svg?react";
import UsStateSouthDakotaMap from "./assets/south-dakota.svg?react";
import UsStateTennesseeMap from "./assets/tennessee.svg?react";
import UsStateTexasMap from "./assets/texas.svg?react";
import UsStateUtahMap from "./assets/utah.svg?react";
import UsStateVermontMap from "./assets/vermont.svg?react";
import UsStateVirginiaMap from "./assets/virginia.svg?react";
import UsStateWashingtonMap from "./assets/washington.svg?react";
import UsStateWestVirginiaMap from "./assets/west-virginia.svg?react";
import UsStateWisconsinMap from "./assets/wisconsin.svg?react";
import UsStateWyomingMap from "./assets/wyoming.svg?react";

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
