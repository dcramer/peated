import { TAG_CATEGORIES } from "@peated/server/constants";
import type { TagCategory } from "@peated/server/types";

type WheelCategoryDefinition = {
  description: string;
  name: string;
  notes: readonly string[];
  wheelNotes: readonly [string, string, string];
};

export const CATEGORY_DEFINITIONS = {
  cereal: {
    name: "Cereal",
    description: "Malt, bread, dough, and porridge.",
    wheelNotes: ["malt", "biscuit", "porridge"],
    notes: [
      "malt",
      "biscuit",
      "porridge",
      "barley sugar",
      "sourdough",
      "popcorn",
    ],
  },
  fruit: {
    name: "Fruit",
    description: "Fresh, dried, cooked, tropical, and citrus fruit.",
    wheelNotes: ["apple", "citrus", "raisin"],
    notes: [
      "green apple",
      "pear",
      "apricot",
      "lemon zest",
      "dried fruit",
      "raisin",
    ],
  },
  floral: {
    name: "Floral",
    description: "Flowers, herbs, leaves, grass, and tea.",
    wheelNotes: ["heather", "mint", "grass"],
    notes: ["heather", "cut grass", "lavender", "mint", "jasmine", "green tea"],
  },
  smoke: {
    name: "Smoke",
    description: "Peat smoke, ash, medicine, wet stone, and sea air.",
    wheelNotes: ["bonfire", "peat", "iodine"],
    notes: ["iodine", "seaweed", "bonfire", "brine", "wet stone", "smoke"],
  },
  earthy: {
    name: "Earthy",
    description: "Leather, tobacco, nuts, coffee, wax, soil, and savory food.",
    wheelNotes: ["leather", "coffee", "wax"],
    notes: ["leather", "tobacco", "mushroom", "coffee", "walnut", "wax"],
  },
  sulfur: {
    name: "Sulfur",
    description: "Struck matches, rubber, metal, onion, and fireworks.",
    wheelNotes: ["struck match", "rubber", "copper"],
    notes: [
      "struck match",
      "rubber",
      "gunpowder",
      "copper",
      "onion",
      "firework",
    ],
  },
  sweet: {
    name: "Sweet",
    description: "Honey, vanilla, caramel, toffee, cream, and chocolate.",
    wheelNotes: ["honey", "vanilla", "caramel"],
    notes: ["honey", "vanilla", "caramel", "toffee", "cream", "chocolate"],
  },
  spice: {
    name: "Spice",
    description: "Pepper, cinnamon, clove, ginger, and licorice.",
    wheelNotes: ["clove", "cinnamon", "ginger"],
    notes: [
      "black pepper",
      "cinnamon",
      "clove",
      "ginger",
      "licorice",
      "nutmeg",
    ],
  },
  wood: {
    name: "Wood",
    description: "Oak, cedar, resin, sherry, wine, and toasted wood.",
    wheelNotes: ["oak", "sherry", "cedar"],
    notes: ["oak", "sherry", "cedar", "toasted oak", "sandalwood", "resin"],
  },
} as const satisfies Record<TagCategory, WheelCategoryDefinition>;

export const WHEEL_CATEGORIES = TAG_CATEGORIES.map((key) => ({
  key,
  ...CATEGORY_DEFINITIONS[key],
}));

export const NOTE_DESCRIPTIONS = {
  malt: "The warm, grainy aroma of malted barley, often reminiscent of cereal or malt biscuits.",
  biscuit: "A dry, baked cereal note like a plain biscuit or cracker.",
  porridge: "A soft, cooked grain note reminiscent of warm oats.",
  "barley sugar": "A sweet cereal note reminiscent of barley sugar sweets.",
  sourdough: "A bready note with a gently tangy, fermented edge.",
  popcorn: "A warm, toasted corn note, sometimes with a buttery impression.",
  apple:
    "A fresh orchard fruit note, from crisp green apple to ripe or cooked apple.",
  citrus:
    "Bright fruit notes reminiscent of lemon, orange, or grapefruit, including their peel and zest.",
  raisin: "A concentrated dried grape note with a rich, sweet impression.",
  "green apple":
    "A crisp, tart apple note rather than a soft or cooked fruit note.",
  pear: "A light orchard fruit note reminiscent of fresh pear or pear drops.",
  apricot: "A rounded stone fruit note reminiscent of ripe or dried apricot.",
  "lemon zest":
    "The bright, fragrant aroma of the yellow outer peel of a lemon.",
  "dried fruit":
    "Rich fruit notes reminiscent of raisins, dates, figs, or dried apricots.",
  heather: "A delicate floral note with a dry, herbal character.",
  mint: "A fresh herbal note with a cooling impression, like mint leaves.",
  grass: "A fresh green note reminiscent of grass or leafy stems.",
  "cut grass": "The fresh, green aroma of newly cut grass.",
  lavender: "A fragrant floral note with an herbal, sometimes perfumed edge.",
  jasmine: "A fragrant, sweet floral note reminiscent of jasmine blossoms.",
  "green tea": "A light, leafy note with a gently dry or grassy impression.",
  smoke: "A smoky aroma or flavor that can recall a wood fire, embers, or ash.",
  peat: "An earthy smoke note that may recall smoldering peat or damp, smoky earth.",
  iodine: "A sharp medicinal note reminiscent of iodine or antiseptic.",
  seaweed: "A coastal note reminiscent of damp seaweed and the seashore.",
  bonfire: "A wood smoke note reminiscent of an outdoor fire and its embers.",
  brine: "A salty impression reminiscent of seawater or brine.",
  "wet stone": "A mineral impression reminiscent of rain on stone.",
  leather:
    "A dry, earthy aroma reminiscent of leather or an old leather-bound book.",
  coffee: "A roasted note reminiscent of coffee beans or brewed coffee.",
  wax: "A note reminiscent of beeswax or candle wax; it can also describe a waxy texture.",
  tobacco: "An earthy, aromatic note reminiscent of dried tobacco leaves.",
  mushroom: "A damp, earthy note reminiscent of fresh mushrooms.",
  walnut:
    "A dry, nutty note reminiscent of walnuts and their slightly bitter skins.",
  sulfur:
    "A pungent note that can recall struck matches, fireworks, or cooked onion.",
  rubber: "A sharp note reminiscent of rubber, sometimes with a burnt edge.",
  copper: "A metallic impression reminiscent of copper coins.",
  "struck match": "The brief, sharp sulfurous aroma of a freshly struck match.",
  gunpowder: "A dry, smoky, sulfurous note reminiscent of spent gunpowder.",
  onion: "A pungent, savory note reminiscent of raw or cooked onion.",
  firework: "A smoky, sulfurous aroma reminiscent of the air after fireworks.",
  honey:
    "A rounded sweetness and aroma reminiscent of honey, sometimes with a floral edge.",
  vanilla: "A soft, sweet aroma reminiscent of vanilla pods or vanilla cream.",
  caramel: "A cooked sugar note with a warm, sometimes lightly burnt edge.",
  toffee: "A rich cooked sugar note with a buttery impression.",
  cream: "A soft dairy note or a rounded, creamy impression on the palate.",
  chocolate:
    "A cocoa note that can range from sweet milk chocolate to dry dark chocolate.",
  clove: "A warm, pungent spice note reminiscent of cloves.",
  cinnamon: "A warm, sweet wood spice note reminiscent of cinnamon bark.",
  ginger:
    "A bright, warming spice note reminiscent of fresh, dried, or candied ginger.",
  "black pepper": "A dry, pungent spice note with a peppery bite.",
  licorice:
    "A dark, sweet, herbal note reminiscent of licorice root or sweets.",
  nutmeg: "A warm, fragrant spice note with a gently woody character.",
  oak: "A woody note that can seem fresh, dry, toasted, or gently tannic.",
  sherry:
    "A wine-like note that may recall dried fruit, nuts, or the aroma of sherry.",
  cedar: "A dry, fragrant wood note reminiscent of cedar or pencil shavings.",
  "toasted oak":
    "A warm, toasted wood note, sometimes reminiscent of char or baking spice.",
  sandalwood: "A fragrant wood note with a soft, warm, perfumed character.",
  resin: "A concentrated woody note reminiscent of tree resin or pine sap.",
} satisfies Record<string, string>;
