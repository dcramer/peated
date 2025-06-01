import type { Badge } from "@peated/server/types";
import classNames from "../lib/classNames";

export function PlaceholderBadgeImage({
  size = 64,
  isMaxLevel = false,
}: {
  size?: number;
  isMaxLevel?: boolean;
}) {
  return (
    <div
      className={classNames(
        "rounded ring-2 ring-inset",
        isMaxLevel ? "ring-highlight" : "ring-slate-800"
      )}
      style={{
        width: size,
        height: size,
      }}
    />
  );
}

export default function BadgeImage({
  badge,
  level,
  size = 64,
}: {
  badge: Badge;
  level?: number;
  size?: number;
}) {
  const isMaxLevel = level === badge.maxLevel;

  if (!badge.imageUrl)
    return <PlaceholderBadgeImage size={size} isMaxLevel={isMaxLevel} />;
  return (
    <img
      src={badge.imageUrl}
      alt={badge.name}
      className={classNames(
        "rounded",
        isMaxLevel ? "ring-1 ring-highlight ring-inset" : ""
      )}
      style={{
        width: size,
        height: size,
      }}
    />
  );
}
