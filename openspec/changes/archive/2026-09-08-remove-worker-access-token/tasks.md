## 1. Shared mutation capabilities

- [x] 1.1 Extract store-price batch persistence from the HTTP route into an actor-aware domain function.
- [x] 1.2 Extract external-site configuration and review persistence into shared domain functions.
- [x] 1.3 Extract Bottle image persistence into a shared domain function.
- [x] 1.4 Make Bottle create and update internals actor-driven and add narrow Peated-system wrappers.

## 2. Worker migration

- [x] 2.1 Migrate price and Bottle scraper helpers from oRPC calls to internal system capabilities.
- [x] 2.2 Migrate the Whisky Advocate job from oRPC calls to internal system capabilities.
- [x] 2.3 Remove worker-side `ACCESS_TOKEN` branching and make dry-run an explicit option.

## 3. Verification

- [x] 3.1 Add or update focused tests for system attribution, route delegation, and explicit dry-run behavior.
- [x] 3.2 Run targeted server tests, server typecheck, lint/format checks, and the Decadent Drams local scraper QA.
