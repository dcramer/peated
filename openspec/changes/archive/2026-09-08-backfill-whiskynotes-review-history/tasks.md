## 1. Run Continuation

- [x] 1.1 Add an opt-in source definition flag that seeds a new run from the
      last successful run cursor
- [x] 1.2 Add lifecycle tests for successful cursor continuation and failed-run
      exclusion

## 2. WhiskyNotes History

- [x] 2.1 Update the compatible WhiskyNotes cursor and adapter to refresh
      current reviews and advance at most four historical pages per run
- [x] 2.2 Add adapter tests for cross-run progress, current review refresh,
      within-page resume, archive completion, and prior cursor compatibility
- [x] 2.3 Enable daily WhiskyNotes runs and update registry coverage

## 3. Documentation And Verification

- [x] 3.1 Update the external review operating and source research documents
- [x] 3.2 Run focused tests, server typecheck, lint, format, and OpenSpec
      validation
- [x] 3.3 Run the registered adapter against current public pages without
      product writes and inspect requests, observations, and cursor progress
