UPDATE entity SET country_id = (SELECT id FROM country WHERE LOWER(name) = LOWER(entity.country)) WHERE country is not null;
