import Link from "@peated/web/components/link";
import type { ComponentPropsWithoutRef } from "react";
import { formatFlavorProfile } from "../../../server/src/lib/format";
import type { FlavorProfile as FlavorProfileType } from "../../../server/src/types";

export default function FlavorProfile({
  profile,
  ...props
}: { profile: FlavorProfileType | string } & ComponentPropsWithoutRef<"div">) {
  const classes = classesForProfile(profile);
  return (
    <span
      className={`rounded px-2 py-1 text-white text-xs ${classes.bg} ${classes.bgHover}`}
      {...props}
    >
      <Link
        href={{
          pathname: "/bottles",
          search: `?flavorProfile=${encodeURIComponent(profile)}`,
        }}
      >
        {formatFlavorProfile(profile)}
      </Link>
    </span>
  );
}

export function classesForProfile(profile: FlavorProfileType | string): {
  bg: string;
  bgHover: string;
  border: string;
} {
  switch (profile) {
    case "young_spritely":
      return {
        bg: "bg-pink-600",
        bgHover: "hover:bg-pink-500",
        border: "border-pink-600",
      };
    case "sweet_fruit_mellow":
      return {
        bg: "bg-fuchsia-600",
        bgHover: "hover:bg-fuchsia-500",
        border: "border-fuchsia-600",
      };
    case "spicy_sweet":
      return {
        bg: "bg-violet-600",
        bgHover: "hover:bg-violet-500",
        border: "border-violet-600",
      };
    case "spicy_dry":
      return {
        bg: "bg-yellow-600",
        bgHover: "hover:bg-yellow-500",
        border: "border-yellow-600",
      };
    case "deep_rich_dried_fruit":
      return {
        bg: "bg-orange-600",
        bgHover: "hover:bg-orange-500",
        border: "border-orange-600",
      };
    case "old_dignified":
      return {
        bg: "bg-red-600",
        bgHover: "hover:bg-red-500",
        border: "bprder-red-600",
      };
    case "light_delicate":
      return {
        bg: "bg-sky-600",
        bgHover: "hover:bg-sky-500",
        border: "border-sky-600",
      };
    case "juicy_oak_vanilla":
      return {
        bg: "bg-cyan-600",
        bgHover: "hover:bg-cyan-500",
        border: "border-cyan-600",
      };
    case "oily_coastal":
      return {
        bg: "bg-blue-600",
        bgHover: "hover:bg-blue-500",
        border: "border-blue-600",
      };
    case "lightly_peated":
      return {
        bg: "bg-emerald-600",
        bgHover: "hover:bg-emerald-500",
        border: "border-emerald-600",
      };
    case "peated":
      return {
        bg: "bg-green-600",
        bgHover: "hover:bg-green-500",
        border: "border-green-600",
      };
    case "heavily_peated":
      return {
        bg: "bg-lime-600",
        bgHover: "hover:bg-lime-500",
        border: "border-lime-600",
      };
    default:
      return {
        bg: "",
        bgHover: "",
        border: "",
      };
  }
}
