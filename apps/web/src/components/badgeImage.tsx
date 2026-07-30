"use client";

import { type Badge } from "@peated/server/types";
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
        isMaxLevel ? "ring-highlight" : "ring-slate-800",
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
    <span
      className="relative inline-block shrink-0"
      style={{
        width: size,
        height: size,
      }}
    >
      <span className="absolute inset-0">
        <PlaceholderBadgeImage size={size} isMaxLevel={isMaxLevel} />
      </span>
      <img
        src={badge.imageUrl}
        alt=""
        className={classNames(
          "relative rounded",
          isMaxLevel ? "ring-highlight ring-1 ring-inset" : "",
        )}
        style={{
          width: size,
          height: size,
        }}
        onError={(event) => {
          event.currentTarget.hidden = true;
        }}
      />
    </span>
  );
}
