import { type ComponentPropsWithoutRef } from "react";
import { formatFlavorProfile } from "../../../server/src/lib/format";
import { type FlavorProfile } from "../../../server/src/types";

export default ({
  profile,
  ...props
}: { profile: FlavorProfile | string } & ComponentPropsWithoutRef<"div">) => {
  const classes = classesForProfile(profile);
  return (
    <span className={`rounded px-2 py-1 text-xs ${classes.bg}`} {...props}>
      {formatFlavorProfile(profile)}
    </span>
  );
};

export function classesForProfile(profile: FlavorProfile | string): {
  bg: string;
  bgHover: string;
  light: string;
} {
  switch (profile) {
    case "young_spritely":
      return {
        bg: "bg-pink-600",
        bgHover: "hover:bg-pink-500",
        light: "text-pink-200",
      };
    case "sweet_fruit_mellow":
      return {
        bg: "bg-fuchsia-600",
        bgHover: "hover:bg-fuchsia-500",
        light: "text-fuchsia-200",
      };
    case "spicy_sweet":
      return {
        bg: "bg-violet-600",
        bgHover: "hover:bg-violet-500",
        light: "text-violet-200",
      };
    case "spicy_dry":
      return {
        bg: "bg-yellow-600",
        bgHover: "hover:bg-yellow-500",
        light: "text-yellow-200",
      };
    case "deep_rich_dried_fruit":
      return {
        bg: "bg-orange-600",
        bgHover: "hover:bg-orange-500",
        light: "text-orange-200",
      };
    case "old_dignified":
      return {
        bg: "bg-red-600",
        bgHover: "hover:bg-red-500",
        light: "text-red-200",
      };
    case "light_delicate":
      return {
        bg: "bg-sky-600",
        bgHover: "hover:bg-sky-500",
        light: "text-sky-200",
      };
    case "juicy_oak_vanilla":
      return {
        bg: "bg-cyan-600",
        bgHover: "hover:bg-cyan-500",
        light: "text-cyan-200",
      };
    case "oily_coastal":
      return {
        bg: "bg-blue-600",
        bgHover: "hover:bg-blue-500",
        light: "text-blue-200",
      };
    case "lightly_peated":
      return {
        bg: "bg-emerald-600",
        bgHover: "hover:bg-emerald-500",
        light: "text-emerald-200",
      };
    case "peated":
      return {
        bg: "bg-green-600",
        bgHover: "hover:bg-green-500",
        light: "text-green-200",
      };
    case "heavily_peated":
      return {
        bg: "bg-lime-600",
        bgHover: "hover:bg-lime-500",
        light: "text-lime-200",
      };
    default:
      return {
        bg: "",
        bgHover: "",
        light: "",
      };
  }
}
