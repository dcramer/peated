## 1. Route ownership

- [x] 1.1 Rename the completed `(redesign)` route group and layout to their permanent application names without changing public paths
- [x] 1.2 Move homepage, brand, and flight route adapters beside their route owners
- [x] 1.3 Move shared search, authentication, error, flash-message, and admin runtime components to semantic feature owners

## 2. Design-system boundary

- [x] 2.1 Remove runtime hooks and the `product` category from `components/designSystem`
- [x] 2.2 Narrow internal-only component exports and confirm no old product import paths remain
- [x] 2.3 Update `DESIGN.md` and web agent guidance for the permanent ownership rules

## 3. Validation

- [x] 3.1 Format and lint every changed web and OpenSpec file
- [x] 3.2 Run the web typecheck and Storybook production build
- [x] 3.3 Validate the OpenSpec change and inspect the final diff for unchanged routes and behavior
