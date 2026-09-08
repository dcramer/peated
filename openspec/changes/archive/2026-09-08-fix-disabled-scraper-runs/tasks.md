## 1. Runtime availability

- [x] 1.1 Reject disabled targets before manual or scheduled run insertion and translate manual rejection at the API boundary
- [x] 1.2 Recheck target enablement before worker adapter execution and store a bounded terminal error
- [x] 1.3 Preserve permanent invalid-request failures during robots refresh

## 2. Administrator experience

- [x] 2.1 Disable the manual run action for disabled or unsynchronized targets with a specific explanation
- [x] 2.2 Configure Astor Wines as manual-only and separate run, schedule, and traffic-readiness labels

## 3. Regression coverage

- [x] 3.1 Add focused route, scheduler, worker, robots, and web availability tests
- [x] 3.2 Run targeted tests, typechecks, lint, formatting, and OpenSpec validation
- [x] 3.3 Add manual-only regression coverage and validate the updated admin behavior
