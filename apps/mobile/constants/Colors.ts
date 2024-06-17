import theme from "@peated/design";

const tintColorLight = theme.colors.highlight.DEFAULT;
const tintColorDark = theme.colors.highlight.DEFAULT;

export default {
  light: {
    text: theme.colors.light,
    background: theme.colors.background.DEFAULT,
    tint: tintColorLight,
    tabIconDefault: theme.colors.light,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: theme.colors.light,
    background: theme.colors.background.DEFAULT,
    tint: tintColorDark,
    tabIconDefault: theme.colors.light,
    tabIconSelected: tintColorDark,
  },
};
