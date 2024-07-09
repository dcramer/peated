UPDATE entity SET region_id = (
    SELECT id FROM region WHERE region.country_id = (
        SELECT id FROM country WHERE name = 'United States'
    ) AND entity.region = region.name
) WHERE entity.country_id = (
    SELECT id FROM country WHERE name = 'United States'
) AND region_id IS NULL AND region IS NOT NULL;

UPDATE entity SET region_id = (
    SELECT id FROM region WHERE region.country_id = (
        SELECT id FROM country WHERE name = 'Japan'
    ) AND entity.region = region.name
) WHERE entity.country_id = (
    SELECT id FROM country WHERE name = 'Japan'
) AND region_id IS NULL AND region IS NOT NULL;

UPDATE entity SET region_id = (
    SELECT id FROM region WHERE region.country_id = (
        SELECT id FROM country WHERE name = 'Scotland'
    ) AND entity.region = region.name
) WHERE entity.country_id = (
    SELECT id FROM country WHERE name = 'Scotland'
) AND region_id IS NULL AND region IS NOT NULL;

UPDATE entity SET region_id = (
    SELECT id FROM region WHERE region.country_id = (
        SELECT id FROM country WHERE name = 'Scotland'
    ) AND entity.region = 'Highlands' AND region.name = 'Highland'
) WHERE entity.country_id = (
    SELECT id FROM country WHERE name = 'Scotland'
) AND region_id IS NULL AND region IS NOT NULL;

UPDATE entity SET region_id = (
    SELECT id FROM region WHERE region.country_id = (
        SELECT id FROM country WHERE name = 'Scotland'
    ) AND entity.region = 'Lowlands' AND region.name = 'Lowland'
) WHERE entity.country_id = (
    SELECT id FROM country WHERE name = 'Scotland'
) AND region_id IS NULL AND region IS NOT NULL;
