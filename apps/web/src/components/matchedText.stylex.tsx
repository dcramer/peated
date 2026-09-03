import * as stylex from "@stylexjs/stylex";
import { colors } from "../styles/tokens.stylex";

export function MatchedText({
  query = "",
  text,
}: {
  query?: string;
  text: string;
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const start = normalizedQuery
    ? text.toLocaleLowerCase().indexOf(normalizedQuery)
    : -1;
  if (start < 0) return text;
  const end = start + normalizedQuery.length;
  return (
    <>
      {text.slice(0, start)}
      <mark {...stylex.props(styles.match)}>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

const styles = stylex.create({
  match: {
    borderRadius: "1px",
    backgroundColor: colors.accentTint,
    color: "inherit",
  },
});
