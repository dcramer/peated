import type { TagCategory } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";

import { colors } from "../../styles/tokens.stylex";

const styles = stylex.create({
  cerealFill: { fill: colors.categoryCereal },
  fruitFill: { fill: colors.categoryFruit },
  floralFill: { fill: colors.categoryFloral },
  smokeFill: { fill: colors.categorySmoke },
  earthyFill: { fill: colors.categoryEarthy },
  sulfurFill: { fill: colors.categorySulfur },
  sweetFill: { fill: colors.categorySweet },
  spiceFill: { fill: colors.categorySpice },
  woodFill: { fill: colors.categoryWood },
  cerealOutline: { boxShadow: `inset 0 0 0 1px ${colors.categoryCereal}` },
  fruitOutline: { boxShadow: `inset 0 0 0 1px ${colors.categoryFruit}` },
  floralOutline: { boxShadow: `inset 0 0 0 1px ${colors.categoryFloral}` },
  smokeOutline: { boxShadow: `inset 0 0 0 1px ${colors.categorySmoke}` },
  earthyOutline: { boxShadow: `inset 0 0 0 1px ${colors.categoryEarthy}` },
  sulfurOutline: { boxShadow: `inset 0 0 0 1px ${colors.categorySulfur}` },
  sweetOutline: { boxShadow: `inset 0 0 0 1px ${colors.categorySweet}` },
  spiceOutline: { boxShadow: `inset 0 0 0 1px ${colors.categorySpice}` },
  woodOutline: { boxShadow: `inset 0 0 0 1px ${colors.categoryWood}` },
});

export const tastingCategoryFillStyles = {
  cereal: styles.cerealFill,
  fruit: styles.fruitFill,
  floral: styles.floralFill,
  smoke: styles.smokeFill,
  earthy: styles.earthyFill,
  sulfur: styles.sulfurFill,
  sweet: styles.sweetFill,
  spice: styles.spiceFill,
  wood: styles.woodFill,
} satisfies Record<TagCategory, stylex.StyleXStyles>;

export const tastingCategoryOutlineStyles = {
  cereal: styles.cerealOutline,
  fruit: styles.fruitOutline,
  floral: styles.floralOutline,
  smoke: styles.smokeOutline,
  earthy: styles.earthyOutline,
  sulfur: styles.sulfurOutline,
  sweet: styles.sweetOutline,
  spice: styles.spiceOutline,
  wood: styles.woodOutline,
} satisfies Record<TagCategory, stylex.StyleXStyles>;
