## 1. API

- [x] 1.1 Add the strict per-site price identity coverage response schema and administrator route.
- [x] 1.2 Register the endpoint beside the existing price routes.

## 2. Coverage Query

- [x] 2.1 Resolve the configured external site and compute the five visible StorePrice counts in one aggregate query.
- [x] 2.2 Keep hidden rows excluded and return not found for an unconfigured site.

## 3. Verification

- [x] 3.1 Add integration tests for authorization, site isolation, count semantics, hidden-row exclusion, and missing sites.
- [x] 3.2 Run the focused route test, server typecheck, touched-file lint and format checks, and strict OpenSpec validation.
