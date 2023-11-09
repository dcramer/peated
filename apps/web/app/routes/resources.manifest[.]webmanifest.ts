import { json } from "@remix-run/node";

import glyphUrl from "~/assets/glyph.png";
import logo192Url from "~/assets/logo192.png";
import config from "~/config";

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
              sizes: "128x128",
              type: "image/png",
              purpose: "any monochrome",
            },
          ],
        },
      ],
      icons: [
        {
          src: glyphUrl,
          sizes: "64x64 32x32 24x24 16x16",
          type: "image/png",
        },
        {
          src: logo192Url,
          sizes: "192x192",
          type: "image/png",
          density: "4.0",
        },
        // {
        //   src: "logo512.png",
        //   type: "image/png",
        //   sizes: "512x512",
        // },
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
