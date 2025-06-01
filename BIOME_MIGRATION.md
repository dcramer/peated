# Biome.js Migration Summary

This project has been successfully migrated from ESLint to Biome.js for linting and formatting.

## What Changed

### Dependencies
- **Removed**: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint`, `eslint-plugin-react`, `eslint-config-next`, `prettier-plugin-organize-imports`
- **Added**: `@biomejs/biome`

### Configuration Files
- **Removed**: `.eslintrc.js`, `apps/web/.eslintrc.json`
- **Added**: `biome.json` (root configuration)

### Scripts
- All `lint` scripts across packages now use `biome check` instead of `eslint`
- Root `pnpm lint` command still works via Turbo

### Git Hooks
- `lint-staged` now runs `biome check --write --no-errors-on-unmatched --files-ignore-unknown=true` instead of separate Prettier and ESLint commands

## Biome Configuration

The `biome.json` configuration matches your previous ESLint rules:

- **Import type enforcement**: Equivalent to `@typescript-eslint/consistent-type-imports`
- **Disabled rules**: `noUnusedVariables`, `useExhaustiveDependencies`, `noNonNullAssertion`, `useConst`, `noExplicitAny`, `noEmptyInterface`
- **Added bonus**: Tailwind class sorting via `useSortedClasses`

## Commands

- **Lint**: `pnpm lint` (runs across all packages via Turbo)
- **Fix**: `pnpm biome check --write` (applies safe fixes)
- **Fix with unsafe**: `pnpm biome check --write --unsafe` (applies all fixes)
- **Format only**: `pnpm biome format --write`

## Benefits

1. **Faster**: Biome is significantly faster than ESLint
2. **All-in-one**: Combines linting, formatting, and import sorting
3. **Better TypeScript support**: Native TypeScript support without plugins
4. **Modern**: Built with Rust for performance
5. **Simplified toolchain**: One tool instead of ESLint + Prettier + plugins

## Migration Notes

- Biome's rules are slightly different from ESLint, but the configuration has been tuned to match your previous setup as closely as possible
- Some formatting preferences may differ slightly from Prettier, but Biome's formatting is consistent and follows modern JavaScript standards
- The git hooks still work the same way - staged files will be automatically linted and formatted on commit
