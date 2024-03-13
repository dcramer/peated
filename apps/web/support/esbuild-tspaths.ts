// MIT License

// Copyright (c) 2024 David Cramer
// Copyright (c) 2022 Frank Leng

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Based on esbuild-ts-paths, but updated to handle `extends` in tsconfig.

import fg from "fast-glob";
import fs from "fs";
import { resolve } from "path";

const normalizePath =
  process.platform === "win32" ? require("normalize-path") : (x: string) => x;

function stripJsonComments(data: string) {
  return data.replace(
    /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
    (m, g) => (g ? "" : m),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

function fixExpression(value: string) {
  // replace globs with regexp matcher
  return value.replace("\\*", ".*");
}

async function collectPaths(tsconfigPath: string) {
  // returns file:// so we gotta strip prefix
  const absTsconfigPath = import.meta.resolve(tsconfigPath).substring(6);

  console.debug(`Importing tsconfig: ${tsconfigPath}`);
  let rawTsconfig = fs.readFileSync(absTsconfigPath, "utf8");
  rawTsconfig = stripJsonComments(rawTsconfig);
  const data = JSON.parse(rawTsconfig);

  if (data.compilerOptions.paths) {
    return data.compilerOptions.paths;
  }

  if (data.extends) {
    return await collectPaths(data.extends);
  }

  return {};
}

export default (tsconfigPath = "./tsconfig.json") => {
  return {
    name: "@peated/esbuild-tspaths",

    async setup(build: any) {
      const paths = await collectPaths(tsconfigPath);
      const pathKeys = Object.keys(paths);

      const filterRe = new RegExp(
        `^(${pathKeys.map(escapeRegExp).map(fixExpression).join("|")})`,
      );

      build.onResolve({ filter: filterRe }, async ({ path }: any) => {
        const pathKey = pathKeys.find((pkey) =>
          new RegExp(`^${pkey}`).test(path),
        );

        if (!pathKey) throw new Error("Unable to identify path");

        const [pathDir] = pathKey.split("*");
        let file = path.replace(pathDir, "");
        if (file === path) {
          // if importing from root of alias
          file = "";
        }

        for (const dir of paths[pathKey]) {
          const fileDir = normalizePath(
            resolve(process.cwd(), dir).replace("*", file),
          );

          let [matchedFile] = fg.sync(`${fileDir}.*`);
          if (!matchedFile) {
            const [matchIndexFile] = fg.sync(`${fileDir}/index.*`);
            matchedFile = matchIndexFile;
          }
          if (matchedFile) {
            return { path: matchedFile };
          }
        }
        return { path };
      });
    },
  };
};
