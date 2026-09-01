import config from "@peated/web/config";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Peated",
    short_name: "Peated",
    description: config.DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: config.THEME_COLOR_LIGHT,
    theme_color: config.THEME_COLOR_LIGHT,
    icons: [
      {
        src: "/assets/glyph-black.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/glyph-black-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/glyph-black-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
