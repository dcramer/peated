import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "./tailwind/base";

const { theme } = resolveConfig(tailwindConfig);

export default theme;
