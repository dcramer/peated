type BottleLabelSource = {
  name: string;
  brand: {
    name: string;
    shortName?: string | null;
  };
  group?: {
    name: string;
  };
};

export function getBottleLabel(bottle: BottleLabelSource) {
  const brandName = bottle.brand.shortName || bottle.brand.name;
  const expressionName = bottle.group?.name || bottle.name;

  return `${brandName} ${expressionName}`;
}
