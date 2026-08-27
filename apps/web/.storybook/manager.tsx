import React from "react";
import { Button } from "storybook/internal/components";
import { addons, types, useGlobals } from "storybook/manager-api";

import { quickViewports } from "./viewports";

const ADDON_ID = "peated/responsive-review";
const quickThemes = ["light", "dark"] as const;

function ViewportButton({ label, value }: (typeof quickViewports)[number]) {
  const [globals, updateGlobals] = useGlobals();
  const viewport = globals.viewport?.value;

  return (
    <Button
      active={viewport === value}
      ariaLabel={`Review at ${label} width`}
      onClick={() => updateGlobals({ viewport: { isRotated: false, value } })}
      padding="small"
      size="small"
      variant="ghost"
    >
      {label}
    </Button>
  );
}

function ThemeButton({ theme }: { theme: (typeof quickThemes)[number] }) {
  const [globals, updateGlobals] = useGlobals();
  const label = theme === "light" ? "Light" : "Dark";

  return (
    <Button
      active={globals.theme === theme}
      ariaLabel={`Review in ${label.toLowerCase()} mode`}
      onClick={() => updateGlobals({ theme })}
      padding="small"
      size="small"
      variant="ghost"
    >
      {label}
    </Button>
  );
}

addons.register(ADDON_ID, () => {
  quickViewports.forEach((viewport) => {
    addons.add(`${ADDON_ID}/${viewport.id}`, {
      match: ({ viewMode }) => viewMode === "story" || viewMode === "docs",
      render: () => <ViewportButton {...viewport} />,
      title: `Review at ${viewport.label} width`,
      type: types.TOOL,
    });
  });

  quickThemes.forEach((theme) => {
    addons.add(`${ADDON_ID}/${theme}`, {
      match: ({ viewMode }) => viewMode === "story" || viewMode === "docs",
      render: () => <ThemeButton theme={theme} />,
      title: `Review in ${theme} mode`,
      type: types.TOOL,
    });
  });
});
