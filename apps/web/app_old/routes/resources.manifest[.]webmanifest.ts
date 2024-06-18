import glyphUrl from "@peated/web/assets/glyph.png";
import config from "@peated/web/config";
import { json } from "@remix-run/server-runtime";

export async function loader() {
  return json(
    {
      short_name: "Peated",
      name: "Peated",
      start_url: "/",
      display: "standalone",
      background_color: "#000000",
      theme_color: config.THEME_COLOR,
      shortcuts: [
        {
          name: "Homepage",
          url: "/",
          icons: [
            {
              src: glyphUrl,
              sizes: "512x512 192x192 128x128 64x64 32x32 24x24 16x16",
              type: "image/png",
              purpose: "any monochrome",
            },
          ],
        },
      ],
      icons: [
        {
          src: glyphUrl,
          sizes: "512x512 192x192 64x64 32x32 24x24 16x16",
          type: "image/png",
        },
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=600",
        "Content-Type": "application/manifest+json",
      },
    },
  );
}
