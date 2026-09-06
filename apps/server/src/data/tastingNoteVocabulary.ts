import type { TagCategory } from "@peated/server/types";

export const TASTING_NOTE_SOURCE_URLS = {
  bourbonWheel: "https://www.whiskeymasters.org/bourbon-tasting-flavor-wheel",
  peatedReviews: "https://peated.com/reviews",
  scotchWheel: "https://www.whiskeymasters.org/whisky-tasting-wheel",
  swri: "https://doi.org/10.1002/j.2050-0416.2001.tb00099.x",
  wset: "https://www.wsetglobal.com/media/17557/wset_l3spirits_sat_en_feb2025_issue3.pdf",
} as const;

export type TastingNoteSource = keyof typeof TASTING_NOTE_SOURCE_URLS;

export type TastingNoteVocabularyEntry = {
  name: string;
  synonyms: readonly string[];
  tagCategory: TagCategory;
  sources: readonly TastingNoteSource[];
};

const entry = (
  name: string,
  tagCategory: TagCategory,
  synonyms: readonly string[],
  sources: readonly TastingNoteSource[],
): TastingNoteVocabularyEntry => ({
  name,
  sources,
  synonyms,
  tagCategory,
});

// This inventory is the reviewed delta from the vocabulary installed by
// migrations 0199 and 0270. The tasting wheel owns the mapping: classify a
// note by what it resembles, not by its production cause.
export const TASTING_NOTE_VOCABULARY_ADDITIONS = [
  entry("baked potato", "cereal", [], ["scotchWheel"]),
  entry("boiled corn", "cereal", [], ["scotchWheel"]),
  entry("charred grain", "cereal", [], ["bourbonWheel"]),
  entry("cooked grain", "cereal", ["cooked grains"], ["swri"]),
  entry("cornmeal", "cereal", ["corn meal"], ["swri"]),
  entry(
    "draff",
    "cereal",
    ["mash tun draff", "spent grain"],
    ["scotchWheel", "swri"],
  ),
  entry("husk", "cereal", ["husky"], ["swri", "wset"]),
  entry("mashed potato", "cereal", ["mashed potatoes"], ["scotchWheel"]),
  entry("wheat bread", "cereal", [], ["bourbonWheel"]),
  entry("wort", "cereal", [], ["swri"]),

  entry("artificial fruit", "fruit", [], ["bourbonWheel"]),
  entry("blood orange", "fruit", [], ["peatedReviews"]),
  entry("catty", "fruit", [], ["swri"]),
  entry("fruit cobbler", "fruit", ["cobbler"], ["bourbonWheel"]),
  entry("green banana", "fruit", ["green bananas"], ["swri"]),
  entry("honeydew", "fruit", ["honeydew melon"], ["bourbonWheel"]),
  entry("kirsch", "fruit", ["cherry brandy"], ["peatedReviews"]),
  entry("lemon juice", "fruit", [], ["peatedReviews"]),
  entry("lemonade", "fruit", [], ["peatedReviews"]),
  entry(
    "paint",
    "fruit",
    ["paint fumes"],
    ["bourbonWheel", "scotchWheel", "wset"],
  ),
  entry("peach nectar", "fruit", [], ["peatedReviews"]),
  entry("pith", "fruit", ["citrus pith", "orange pith"], ["bourbonWheel"]),
  entry("pomelo", "fruit", ["pomelos"], ["bourbonWheel"]),
  entry(
    "rind",
    "fruit",
    ["citrus rind", "fruit rind", "orange rind"],
    ["bourbonWheel"],
  ),
  entry(
    "sour",
    "fruit",
    ["sourness", "tangy", "tart"],
    ["bourbonWheel", "peatedReviews", "swri"],
  ),
  entry("stewed apple", "fruit", ["stewed apples"], ["scotchWheel"]),
  entry("tomato stem", "fruit", ["tomato stems"], ["swri"]),
  entry("vinegar", "fruit", ["vinegary"], ["bourbonWheel", "wset"]),

  entry(
    "barber shop",
    "floral",
    ["barber's shop", "barbershop"],
    ["scotchWheel"],
  ),
  entry("bluebell", "floral", ["bluebells", "blue bell"], ["swri"]),
  entry("carnation", "floral", ["carnations"], ["swri"]),
  entry("cough syrup", "floral", [], ["bourbonWheel"]),
  entry("dead flower", "floral", ["dead flowers"], ["bourbonWheel"]),
  entry("dried herb", "floral", ["dried herbs"], ["bourbonWheel"]),
  entry("dry grass", "floral", [], ["bourbonWheel"]),
  entry("dry hay", "floral", ["dried hay"], ["scotchWheel", "swri"]),
  entry("fabric softener", "floral", [], ["scotchWheel"]),
  entry(
    "fir",
    "floral",
    ["fir bud", "fir buds", "fir resin"],
    ["peatedReviews", "scotchWheel"],
  ),
  entry(
    "florist shop",
    "floral",
    ["florist's shop"],
    ["bourbonWheel", "scotchWheel"],
  ),
  entry("flower stem", "floral", ["flower stems"], ["swri"]),
  entry("foliage", "floral", [], ["bourbonWheel"]),
  entry("herb", "floral", ["herbs"], ["peatedReviews"]),
  entry("mulch", "floral", [], ["scotchWheel"]),
  entry("mown hay", "floral", ["mowed hay"], ["scotchWheel"]),
  entry("oolong tea", "floral", ["oolong"], ["bourbonWheel"]),
  entry("potpourri", "floral", [], ["bourbonWheel", "peatedReviews"]),
  entry("straw", "floral", [], ["swri"]),
  entry("tarragon", "floral", [], ["bourbonWheel"]),
  entry("vegetal", "floral", ["vegetation"], ["peatedReviews", "swri"]),
  entry(
    "white lily",
    "floral",
    ["white lilies", "white lilly"],
    ["bourbonWheel"],
  ),
  entry("wintergreen", "floral", [], ["bourbonWheel"]),

  entry("anchovy", "smoke", ["anchovies"], ["scotchWheel"]),
  entry("antiseptic", "smoke", [], ["scotchWheel", "wset"]),
  entry("barbecue", "smoke", ["barbeque", "bbq"], ["peatedReviews", "swri"]),
  entry("brackish", "smoke", [], ["scotchWheel"]),
  entry("burnt stick", "smoke", ["burnt sticks"], ["scotchWheel"]),
  entry("camphor", "smoke", ["camphorous"], ["peatedReviews", "swri"]),
  entry("carbolic", "smoke", ["carbolic soap"], ["scotchWheel"]),
  entry("damp cement", "smoke", [], ["peatedReviews"]),
  entry(
    "hospital",
    "smoke",
    ["hospitals", "hospital ward"],
    ["scotchWheel", "swri"],
  ),
  entry("kipper", "smoke", ["kippers", "kippery"], ["scotchWheel", "swri"]),
  entry("lint", "smoke", [], ["scotchWheel"]),
  entry("moss water", "smoke", [], ["scotchWheel"]),
  entry("peat reek", "smoke", [], ["scotchWheel"]),
  entry("tcp", "smoke", [], ["swri"]),

  entry("boiled pork", "earthy", [], ["scotchWheel"]),
  entry("brewed coffee", "earthy", [], ["bourbonWheel"]),
  entry(
    "cardboard",
    "earthy",
    ["cardboard box"],
    ["bourbonWheel", "scotchWheel", "swri"],
  ),
  entry("cashew", "earthy", ["cashews"], ["bourbonWheel"]),
  entry("cellar", "earthy", ["cellars"], ["bourbonWheel", "scotchWheel"]),
  entry("chestnut", "earthy", ["chestnuts"], ["bourbonWheel", "peatedReviews"]),
  entry("chip fat", "earthy", [], ["swri"]),
  entry("cigar", "earthy", ["cigars"], ["bourbonWheel", "peatedReviews"]),
  entry("cigarette", "earthy", ["cigarettes"], ["bourbonWheel"]),
  entry("dust", "earthy", ["dusty"], ["bourbonWheel"]),
  entry("engine oil", "earthy", [], ["peatedReviews", "swri"]),
  entry("feet", "earthy", ["foot odor", "foot odour"], ["wset"]),
  entry("filter paper", "earthy", ["filter sheet", "filter sheets"], ["swri"]),
  entry(
    "ground coffee",
    "earthy",
    ["coffee grounds"],
    ["bourbonWheel", "scotchWheel"],
  ),
  entry("gravy", "earthy", [], ["scotchWheel"]),
  entry("lanolin", "earthy", ["lanoline"], ["bourbonWheel"]),
  entry("meat fat", "earthy", [], ["swri"]),
  entry(
    "mold",
    "earthy",
    ["moldy", "mould", "mouldy"],
    ["bourbonWheel", "swri"],
  ),
  entry("mothball", "earthy", ["mothballs"], ["swri"]),
  entry("mousy", "earthy", ["mousey"], ["scotchWheel", "swri"]),
  entry("naphtha", "earthy", [], ["swri"]),
  entry("new carpet", "earthy", [], ["bourbonWheel"]),
  entry("old gym shoe", "earthy", ["old gym shoes"], ["scotchWheel"]),
  entry("olive", "earthy", ["olives"], ["peatedReviews", "wset"]),
  entry("paper", "earthy", ["papery"], ["swri"]),
  entry("paraffin", "earthy", [], ["peatedReviews", "swri"]),
  entry("pine nut", "earthy", ["pine nuts"], ["scotchWheel"]),
  entry("pipe tobacco", "earthy", [], ["bourbonWheel", "peatedReviews"]),
  entry("rain", "earthy", ["rainwater"], ["bourbonWheel"]),
  entry("rancid", "earthy", [], ["swri"]),
  entry("rancio", "earthy", [], ["bourbonWheel"]),
  entry("rickhouse", "earthy", ["rick house"], ["bourbonWheel"]),
  entry("sausage", "earthy", ["sausages"], ["scotchWheel"]),
  entry("soapy", "earthy", ["soap"], ["peatedReviews", "swri"]),
  entry("suntan oil", "earthy", ["sun tan oil"], ["scotchWheel"]),
  entry("wet concrete", "earthy", [], ["bourbonWheel"]),
  entry("wet dog", "earthy", [], ["bourbonWheel"]),
  entry("yogurt", "earthy", ["yoghurt"], ["bourbonWheel"]),

  entry("coal gas", "sulfur", ["coal-gas", "gassy"], ["scotchWheel"]),
  entry("decaying", "sulfur", ["decay"], ["swri"]),
  entry("drain", "sulfur", ["drains"], ["wset"]),
  entry("fresh laundry", "sulfur", [], ["scotchWheel"]),
  entry("garden hose", "sulfur", ["rubber hose"], ["bourbonWheel"]),
  entry("linen", "sulfur", [], ["scotchWheel"]),
  entry("plastic", "sulfur", ["plasticky"], ["wset"]),
  entry("plastic rope", "sulfur", [], ["scotchWheel"]),
  entry("vomit", "sulfur", ["vomity"], ["swri"]),

  entry("baker's chocolate", "sweet", ["bakers chocolate"], ["bourbonWheel"]),
  entry(
    "candy",
    "sweet",
    ["confectionery", "sweets"],
    ["bourbonWheel", "peatedReviews"],
  ),
  entry("crème caramel", "sweet", ["creme caramel"], ["scotchWheel"]),
  entry("ice cream", "sweet", [], ["swri"]),
  entry("liqueur", "sweet", ["liquor cordial"], ["peatedReviews"]),
  entry("madeira cake", "sweet", [], ["scotchWheel"]),
  entry("mince pie", "sweet", ["mince pies"], ["scotchWheel"]),
  entry("popcorn butter", "sweet", [], ["bourbonWheel"]),
  entry("sponge cake", "sweet", ["sponge"], ["scotchWheel"]),
  entry(
    "sweet",
    "sweet",
    ["sweetness"],
    ["bourbonWheel", "peatedReviews", "swri"],
  ),
  entry("syrup", "sweet", ["syrupy"], ["peatedReviews"]),
  entry("white chocolate", "sweet", [], ["bourbonWheel"]),
  entry("white sugar", "sweet", [], ["bourbonWheel"]),
  entry("wood sugar", "sweet", ["wood sugars"], ["bourbonWheel"]),

  entry(
    "chili",
    "spice",
    ["chile", "chilli", "red chili", "red chilli"],
    ["peatedReviews", "wset"],
  ),
  entry("green pepper", "spice", ["green peppers"], ["peatedReviews"]),
  entry("jalapeño", "spice", ["jalapeno", "jalapeños", "jalapenos"], ["wset"]),
  entry("mustard", "spice", [], ["peatedReviews"]),
  entry("paprika", "spice", [], ["peatedReviews"]),
  entry(
    "pink peppercorn",
    "spice",
    ["pink peppercorns", "pink pepper"],
    ["peatedReviews"],
  ),
  entry("star anise", "spice", [], ["bourbonWheel"]),

  entry("acrid", "wood", [], ["bourbonWheel"]),
  entry("balsa", "wood", ["balsa wood"], ["bourbonWheel"]),
  entry(
    "bitter",
    "wood",
    ["bitterness"],
    ["bourbonWheel", "peatedReviews", "swri"],
  ),
  entry("bourbon", "wood", ["bourbon cask"], ["swri"]),
  entry("brandy", "wood", [], ["bourbonWheel", "swri"]),
  entry("cork", "wood", ["corked", "corky"], ["scotchWheel", "swri"]),
  entry("green bark", "wood", [], ["swri"]),
  entry("hickory", "wood", ["hickory wood"], ["bourbonWheel"]),
  entry("ink", "wood", ["inky"], ["scotchWheel", "swri"]),
  entry("lacquer", "wood", ["wood lacquer"], ["bourbonWheel"]),
  entry("mahogany", "wood", ["mahogany wood"], ["bourbonWheel"]),
  entry("marsala", "wood", ["marsala wine"], ["bourbonWheel"]),
  entry("retsina", "wood", [], ["swri"]),
  entry("sour cask", "wood", [], ["swri"]),
  entry("tequila", "wood", [], ["bourbonWheel"]),
  entry("tokaji", "wood", ["tokay"], ["bourbonWheel"]),
  entry("turpentine", "wood", [], ["bourbonWheel", "swri"]),
  entry(
    "varnish",
    "wood",
    ["varnished wood", "wood varnish"],
    ["bourbonWheel", "peatedReviews", "wset"],
  ),
  entry("vin santo", "wood", [], ["bourbonWheel"]),
  entry("wet wood", "wood", [], ["swri"]),
] as const satisfies readonly TastingNoteVocabularyEntry[];

export type TastingNoteSynonymAddition = {
  name: string;
  synonyms: readonly string[];
  tagCategory: TagCategory;
  sources: readonly TastingNoteSource[];
};

export const TASTING_NOTE_SYNONYM_ADDITIONS = [
  {
    name: "ash",
    synonyms: ["ashes", "cold ash", "cold ashes"],
    tagCategory: "smoke",
    sources: ["peatedReviews"],
  },
  {
    name: "bacon",
    synonyms: ["smoked bacon"],
    tagCategory: "smoke",
    sources: ["scotchWheel"],
  },
  {
    name: "biscuit",
    synonyms: ["digestive biscuit"],
    tagCategory: "cereal",
    sources: ["swri"],
  },
  {
    name: "black pepper",
    synonyms: ["peppery"],
    tagCategory: "spice",
    sources: ["peatedReviews", "swri"],
  },
  {
    name: "bran",
    synonyms: ["oat bran", "rice bran", "wheat bran"],
    tagCategory: "cereal",
    sources: ["swri"],
  },
  {
    name: "brown sugar",
    synonyms: ["demerara sugar"],
    tagCategory: "sweet",
    sources: ["peatedReviews"],
  },
  {
    name: "caramel",
    synonyms: ["caramel sauce"],
    tagCategory: "sweet",
    sources: ["peatedReviews"],
  },
  {
    name: "citrus",
    synonyms: ["zesty"],
    tagCategory: "fruit",
    sources: ["peatedReviews"],
  },
  {
    name: "cola",
    synonyms: ["dr pepper", "dr. pepper"],
    tagCategory: "spice",
    sources: ["bourbonWheel"],
  },
  {
    name: "corn",
    synonyms: ["maize"],
    tagCategory: "cereal",
    sources: ["swri"],
  },
  {
    name: "dried fruit",
    synonyms: ["dehydrated fruit"],
    tagCategory: "fruit",
    sources: ["bourbonWheel"],
  },
  {
    name: "farmyard",
    synonyms: ["cattle", "farmy"],
    tagCategory: "earthy",
    sources: ["peatedReviews", "scotchWheel"],
  },
  {
    name: "fruit",
    synonyms: ["fruitiness", "fruits"],
    tagCategory: "fruit",
    sources: ["peatedReviews"],
  },
  {
    name: "green herb",
    synonyms: ["green herbs"],
    tagCategory: "floral",
    sources: ["peatedReviews"],
  },
  {
    name: "hops",
    synonyms: ["dried hops"],
    tagCategory: "cereal",
    sources: ["scotchWheel"],
  },
  {
    name: "jam",
    synonyms: ["fruit jelly", "jelly", "preserves"],
    tagCategory: "fruit",
    sources: ["peatedReviews"],
  },
  {
    name: "lemon",
    synonyms: ["lemony"],
    tagCategory: "fruit",
    sources: ["peatedReviews"],
  },
  {
    name: "library book",
    synonyms: ["old library"],
    tagCategory: "earthy",
    sources: ["bourbonWheel"],
  },
  {
    name: "malt",
    synonyms: ["malty"],
    tagCategory: "cereal",
    sources: ["peatedReviews"],
  },
  {
    name: "metal",
    synonyms: ["metallic", "tinny"],
    tagCategory: "sulfur",
    sources: ["scotchWheel", "swri"],
  },
  {
    name: "mineral",
    synonyms: ["minerality"],
    tagCategory: "smoke",
    sources: ["peatedReviews"],
  },
  {
    name: "must",
    synonyms: ["fusty"],
    tagCategory: "earthy",
    sources: ["swri"],
  },
  {
    name: "oil",
    synonyms: ["oils"],
    tagCategory: "earthy",
    sources: ["peatedReviews"],
  },
  {
    name: "peat",
    synonyms: ["phenolic"],
    tagCategory: "smoke",
    sources: ["peatedReviews", "swri"],
  },
  {
    name: "pencil shaving",
    synonyms: ["pencil", "sharpened pencil"],
    tagCategory: "wood",
    sources: ["scotchWheel", "swri"],
  },
  {
    name: "pine",
    synonyms: ["pine essence"],
    tagCategory: "floral",
    sources: ["scotchWheel"],
  },
  {
    name: "polish",
    synonyms: ["wood polish"],
    tagCategory: "earthy",
    sources: ["bourbonWheel"],
  },
  {
    name: "rotten egg",
    synonyms: ["egg"],
    tagCategory: "sulfur",
    sources: ["bourbonWheel"],
  },
  {
    name: "salt",
    synonyms: ["saline", "salinity", "saltiness", "sea water", "seawater"],
    tagCategory: "smoke",
    sources: ["peatedReviews"],
  },
  {
    name: "sea air",
    synonyms: ["coastal", "maritime"],
    tagCategory: "smoke",
    sources: ["peatedReviews"],
  },
  {
    name: "sherry",
    synonyms: ["sherried"],
    tagCategory: "wood",
    sources: ["peatedReviews"],
  },
  {
    name: "solvent",
    synonyms: ["fusel oil", "nail varnish remover", "paint thinner"],
    tagCategory: "fruit",
    sources: ["scotchWheel", "swri", "wset"],
  },
  {
    name: "spice",
    synonyms: ["spices"],
    tagCategory: "spice",
    sources: ["peatedReviews"],
  },
  {
    name: "stagnant water",
    synonyms: ["stagnant"],
    tagCategory: "sulfur",
    sources: ["scotchWheel", "swri"],
  },
  {
    name: "struck match",
    synonyms: ["spent match", "spent matches"],
    tagCategory: "sulfur",
    sources: ["bourbonWheel", "wset"],
  },
  {
    name: "tropical fruit",
    synonyms: ["tropical fruits"],
    tagCategory: "fruit",
    sources: ["peatedReviews"],
  },
  {
    name: "wax",
    synonyms: ["waxiness"],
    tagCategory: "earthy",
    sources: ["peatedReviews"],
  },
  {
    name: "wood",
    synonyms: ["woods"],
    tagCategory: "wood",
    sources: ["peatedReviews"],
  },
] as const satisfies readonly TastingNoteSynonymAddition[];

export const TASTING_NOTE_EXCLUSION_RULES = [
  "appearance and color",
  "texture and body without an aroma or flavor meaning",
  "alcoholic heat and cooling sensation",
  "finish length",
  "quality, balance, complexity, and other evaluation",
  "production materials that are not used as sensory references",
  "arbitrary adjective and ingredient combinations",
] as const;

export const TASTING_NOTE_AMBIGUOUS_MAPPINGS = [
  {
    name: "bitter",
    tagCategory: "wood",
    reason:
      "Whisky bitterness most often resembles tannic or over-extracted wood.",
  },
  {
    name: "paint",
    tagCategory: "fruit",
    reason:
      "Peated's fruit family already owns fermentation-derived solvent notes.",
  },
  {
    name: "sour",
    tagCategory: "fruit",
    reason:
      "The fruit family already owns acidic notes and tart fruit references.",
  },
  {
    name: "varnish",
    tagCategory: "wood",
    reason:
      "The familiar reference is a varnished wood surface, not a generic solvent.",
  },
] as const satisfies readonly {
  name: string;
  tagCategory: TagCategory;
  reason: string;
}[];
