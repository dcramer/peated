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
  cerealSelectedOutline: {
    boxShadow: `inset 0 0 0 2px ${colors.categoryCereal}`,
  },
  fruitSelectedOutline: {
    boxShadow: `inset 0 0 0 2px ${colors.categoryFruit}`,
  },
  floralSelectedOutline: {
    boxShadow: `inset 0 0 0 2px ${colors.categoryFloral}`,
  },
  smokeSelectedOutline: {
    boxShadow: `inset 0 0 0 2px ${colors.categorySmoke}`,
  },
  earthySelectedOutline: {
    boxShadow: `inset 0 0 0 2px ${colors.categoryEarthy}`,
  },
  sulfurSelectedOutline: {
    boxShadow: `inset 0 0 0 2px ${colors.categorySulfur}`,
  },
  sweetSelectedOutline: {
    boxShadow: `inset 0 0 0 2px ${colors.categorySweet}`,
  },
  spiceSelectedOutline: {
    boxShadow: `inset 0 0 0 2px ${colors.categorySpice}`,
  },
  woodSelectedOutline: {
    boxShadow: `inset 0 0 0 2px ${colors.categoryWood}`,
  },
  cerealBorder: { borderColor: colors.categoryCereal },
  fruitBorder: { borderColor: colors.categoryFruit },
  floralBorder: { borderColor: colors.categoryFloral },
  smokeBorder: { borderColor: colors.categorySmoke },
  earthyBorder: { borderColor: colors.categoryEarthy },
  sulfurBorder: { borderColor: colors.categorySulfur },
  sweetBorder: { borderColor: colors.categorySweet },
  spiceBorder: { borderColor: colors.categorySpice },
  woodBorder: { borderColor: colors.categoryWood },
  cerealBackground: { backgroundColor: colors.categoryCereal },
  fruitBackground: { backgroundColor: colors.categoryFruit },
  floralBackground: { backgroundColor: colors.categoryFloral },
  smokeBackground: { backgroundColor: colors.categorySmoke },
  earthyBackground: { backgroundColor: colors.categoryEarthy },
  sulfurBackground: { backgroundColor: colors.categorySulfur },
  sweetBackground: { backgroundColor: colors.categorySweet },
  spiceBackground: { backgroundColor: colors.categorySpice },
  woodBackground: { backgroundColor: colors.categoryWood },
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

export const tastingCategorySelectedOutlineStyles = {
  cereal: styles.cerealSelectedOutline,
  fruit: styles.fruitSelectedOutline,
  floral: styles.floralSelectedOutline,
  smoke: styles.smokeSelectedOutline,
  earthy: styles.earthySelectedOutline,
  sulfur: styles.sulfurSelectedOutline,
  sweet: styles.sweetSelectedOutline,
  spice: styles.spiceSelectedOutline,
  wood: styles.woodSelectedOutline,
} satisfies Record<TagCategory, stylex.StyleXStyles>;

export const tastingCategoryBorderStyles = {
  cereal: styles.cerealBorder,
  fruit: styles.fruitBorder,
  floral: styles.floralBorder,
  smoke: styles.smokeBorder,
  earthy: styles.earthyBorder,
  sulfur: styles.sulfurBorder,
  sweet: styles.sweetBorder,
  spice: styles.spiceBorder,
  wood: styles.woodBorder,
} satisfies Record<TagCategory, stylex.StyleXStyles>;

export const tastingCategoryBackgroundStyles = {
  cereal: styles.cerealBackground,
  fruit: styles.fruitBackground,
  floral: styles.floralBackground,
  smoke: styles.smokeBackground,
  earthy: styles.earthyBackground,
  sulfur: styles.sulfurBackground,
  sweet: styles.sweetBackground,
  spice: styles.spiceBackground,
  wood: styles.woodBackground,
} satisfies Record<TagCategory, stylex.StyleXStyles>;
