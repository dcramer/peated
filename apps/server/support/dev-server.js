import { execa } from "execa";

if (process.env.NODE_ENV === "production") {
  await import("./src/server.ts");
} else {
  const command =
    'tsx watch --clear-screen=false --ignore ".cache/**" --ignore "app/**" --ignore "vite.config.ts.timestamp-*" --ignore "build/**" --ignore "node_modules/**" --inspect ./src/server.ts';
  execa(command, {
    stdio: ["ignore", "inherit", "inherit"],
    shell: true,
    env: {
      FORCE_COLOR: true,
      ...process.env,
    },
    // https://github.com/sindresorhus/execa/issues/433
    windowsHide: false,
  });
}
