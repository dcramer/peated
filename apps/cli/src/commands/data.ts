import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import type { FlavorProfile, TagCategory } from "@peated/server/types";

const TAGS: Record<TagCategory, string[]> = {
  cereal: [
    "barley sugar",
    "biscuity",
    "oatmeal",
    "grains",
    "malted barley",
    "rye",
    "wheat",
    "corn",
    "fresh hay",
    "bread",
  ],
  fruity: [
    "acidic",
    "green apple",
    "lemon zest",
    "fresh berries",
    "citrus",
    "lime",
    "ripe peach",
    "juicy pear",
    "mellow apricot",
    "soft cherry",
    "ripe melon",
    "banana",
    "apple pie",
    "stewed fruits",
  ],
  floral: [
    "light floral",
    "soft floral",
    "lavender",
    "fresh flowers",
    "green leaves",
    "heather",
    "delicate herbs",
  ],
  peaty: [
    "alcohol burn",
    "light smoke",
    "gentle peat",
    "smoked herbs",
    "peat moss",
    "earthy peat",
    "smoked wood",
    "balanced smoke",
    "intense smoke",
    "heavy iodine",
    "tar",
    "burnt rubber",
    "creosote",
    "smoked meat",
    "charred oak",
    "deep peat",
  ],
  feinty: [
    "old books",
    "antique leather",
    "tobacco",
    "earthiness",
    "soft musk",
    "aged sherry",
    "library books",
    "tobacco leaf",
  ],
  sulphury: ["burnt matches", "gunpowder"],
  woody: [
    "anise",
    "baking spices",
    "nutmeg",
    "old oak",
    "polished wood",
    "vanilla bean",
    "creamy oak",
    "maple syrup",
    "butterscotch",
    "ripe apples",
    "toasted almonds",
    "oak spices",
    "juicy pears",
    "antique wood",
    "oak",
    "sherry",
  ],
  winey: [
    "luxurious sherry",
    "dark chocolate",
    "walnut",
    "coffee beans",
    "date",
    "currants",
    "rich prunes",
    "dried figs",
    "raisins",
    "fruit cake",
  ],
};

const PROFILES: Record<FlavorProfile, string[]> = {
  young_spritely: [
    "green apple",
    "lemon zest",
    "fresh berries",
    "citrus",
    "grass",
    "lime",
    "light floral",
    "sparkling",
  ],
  sweet_fruit_mellow: [
    "cake",
    "candy",
    "ripe peach",
    "juicy pear",
    "mellow apricot",
    "soft cherry",
    "barley sugar",
    "marmalade",
    "ripe melon",
    "banana",
  ],
  spicy_sweet: [
    "anise",
    "baking spices",
    "cinnamon",
    "sweet ginger",
    "vanilla",
    "caramel",
    "honey",
    "rich nutmeg",
    "warm clove",
    "spiced cake",
  ],
  spicy_dry: [
    "bitter",
    "fiery",
    "dry pepper",
    "herbal notes",
    "crisp ginger",
    "subtle oak",
    "cardamom",
    "sandalwood",
    "black tea",
    "tobacco leaf",
  ],
  deep_rich_dried_fruit: [
    "dried figs",
    "raisins",
    "rich prunes",
    "luxurious sherry",
    "dark chocolate",
    "walnut",
    "coffee beans",
    "date",
  ],
  old_dignified: [
    "balanced",
    "antique leather",
    "old oak",
    "tobacco",
    "polished wood",
    "earthiness",
    "soft musk",
    "aged sherry",
    "library books",
  ],
  light_delicate: [
    "acidic",
    "clean",
    "soft floral",
    "lavender",
    "green leaves",
    "light honey",
    "almond",
    "heather",
    "fresh hay",
    "delicate herbs",
  ],
  juicy_oak_vanilla: [
    "butter",
    "vanilla bean",
    "creamy oak",
    "maple syrup",
    "butterscotch",
    "ripe apples",
    "toasted almonds",
    "oak spices",
    "juicy pears",
  ],
  oily_coastal: [
    "ethanol",
    "seaweed",
    "oily texture",
    "salt spray",
    "maritime air",
    "briny notes",
    "clam",
    "oyster",
    "fishing net",
  ],
  lightly_peated: [
    "ethanol",
    "light smoke",
    "gentle peat",
    "fresh mineral",
    "smoked herbs",
    "bonfire embers",
    "peat moss",
    "autumn leaves",
    "grilled citrus",
  ],
  peated: [
    "earthy peat",
    "smoked wood",
    "balanced smoke",
    "leather",
    "campfire",
    "black pepper",
    "wet stones",
    "forest floor",
  ],
  heavily_peated: [
    "alcohol burn",
    "fiery",
    "intense smoke",
    "heavy iodine",
    "tar",
    "burnt rubber",
    "creosote",
    "smoked meat",
    "charred oak",
    "deep peat",
  ],
};

const subcommand = program.command("data");

subcommand.command("load-default-tags").action(async (options) => {
  Object.entries(TAGS).forEach(async ([categoryName, tagList]) => {
    await db.transaction(async (tx) => {
      for (const tagName of tagList) {
        console.log(`Registering tag ${tagName}`);
        await tx
          .insert(tags)
          .values({
            name: tagName,
            tagCategory: categoryName as TagCategory,
            flavorProfiles: Object.entries(PROFILES)
              .filter(([profileName, tagList]) => tagList.includes(tagName))
              .map<FlavorProfile>(
                ([profileName]) => profileName as FlavorProfile,
              ),
          })
          .onConflictDoNothing();
      }
    });
  });
});
