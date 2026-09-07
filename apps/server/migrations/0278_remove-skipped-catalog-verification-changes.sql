-- Verification outcomes are operational telemetry, not catalog changes.
-- Keep this cleanup limited to the old metadata-only skipped-result rows.
DELETE FROM "change"
WHERE "type" = 'update'
  AND "object_type" IN ('bottle', 'entity')
  AND "data" ? 'catalogVerification'
  AND "data" -> 'catalogVerification' ->> 'phase' = 'result'
  AND "data" -> 'catalogVerification' ->> 'status' = 'skipped'
  AND "data" = jsonb_build_object(
    'catalogVerification',
    "data" -> 'catalogVerification'
  );
