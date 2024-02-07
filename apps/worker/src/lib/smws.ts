export function getCategoryFromCask(caskNumber: string) {
  if (caskNumber.startsWith("GN")) {
    return "gin";
  } else if (caskNumber.startsWith("RW")) {
    return "rye";
  } else if (caskNumber.startsWith("CW1")) {
    // corn - where should it go?
    return null;
  } else if (caskNumber.startsWith("B")) {
    return "bourbon";
  } else if (caskNumber.startsWith("R")) {
    return "rum";
  } else if (caskNumber.startsWith("A")) {
    return "armagnac";
  } else if (caskNumber.startsWith("C")) {
    return "cognac";
  } else if (caskNumber.startsWith("G")) {
    return "single_grain";
  } else if (Number(caskNumber[0]) > 0) {
    return "single_malt";
  } else {
    return null;
  }
}
