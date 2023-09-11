-- Clean up invalid tasting stats
UPDATE bottle SET
  total_tastings = (SELECT COUNT(*) FROM tasting WHERE bottle.id = tasting.bottle_id),
  avg_rating = (SELECT AVG(tasting.rating) FROM tasting WHERE bottle.id = tasting.bottle_id);

UPDATE entity SET
  total_tastings = (
    SELECT COUNT(*) FROM tasting
    JOIN bottle ON tasting.bottle_id = bottle.id
    WHERE bottle.brand_id = entity.id
       OR bottle.bottler_id = entity.id
       OR EXISTS (
        SELECT FROM bottle_distiller
        WHERE bottle_distiller.bottle_id = bottle.id
          AND bottle_distiller.distiller_id = entity.id
       )
  );
