import type { ESTree } from "@oxlint/plugins";
import { defineRule } from "@oxlint/plugins";

function importedName(specifier: ESTree.ImportSpecifier): string | null {
  return specifier.imported.type === "Literal"
    ? specifier.imported.value
    : specifier.imported.name;
}

function isSuspenseElement(
  name: ESTree.JSXElementName,
  namedImports: ReadonlySet<string>,
  reactImports: ReadonlySet<string>,
): boolean {
  if (name.type === "JSXIdentifier") return namedImports.has(name.name);
  return (
    name.type === "JSXMemberExpression" &&
    name.object.type === "JSXIdentifier" &&
    reactImports.has(name.object.name) &&
    name.property.name === "Suspense"
  );
}

function fallbackComponentName(
  value: ESTree.JSXAttributeValue | null,
): string | null {
  if (value?.type !== "JSXExpressionContainer") return null;

  let expression = value.expression;
  while (expression.type === "ParenthesizedExpression") {
    expression = expression.expression;
  }
  if (
    expression.type !== "JSXElement" ||
    expression.openingElement.name.type !== "JSXIdentifier"
  ) {
    return null;
  }
  return expression.openingElement.name.name;
}

/** Require visible React Suspense blocks to name the loading component they show. */
export const requireSuspenseLoadingRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require React Suspense to show one named loading component while it waits.",
    },
    messages: {
      missingFallback:
        "Add a named loading component: fallback={<ThingLoading />}.",
      unnamedFallback:
        "Use one named component ending in `Loading`. Keep fixed headings and controls outside Suspense.",
    },
  },
  createOnce(context) {
    const namedImports = new Set<string>();
    const reactImports = new Set<string>();

    return {
      Program(node) {
        namedImports.clear();
        reactImports.clear();

        for (const statement of node.body) {
          if (
            statement.type !== "ImportDeclaration" ||
            statement.source.value !== "react"
          ) {
            continue;
          }
          for (const specifier of statement.specifiers) {
            if (
              specifier.type === "ImportSpecifier" &&
              importedName(specifier) === "Suspense"
            ) {
              namedImports.add(specifier.local.name);
            } else if (
              specifier.type === "ImportDefaultSpecifier" ||
              specifier.type === "ImportNamespaceSpecifier"
            ) {
              reactImports.add(specifier.local.name);
            }
          }
        }
      },
      JSXOpeningElement(node) {
        if (!isSuspenseElement(node.name, namedImports, reactImports)) return;

        const fallback = node.attributes.find(
          (attribute) =>
            attribute.type === "JSXAttribute" &&
            attribute.name.type === "JSXIdentifier" &&
            attribute.name.name === "fallback",
        );
        if (fallback?.type !== "JSXAttribute") {
          context.report({ node, messageId: "missingFallback" });
          return;
        }

        const componentName = fallbackComponentName(fallback.value);
        if (componentName?.endsWith("Loading") !== true) {
          context.report({ node: fallback, messageId: "unnamedFallback" });
        }
      },
    };
  },
});
