UPDATE entity SET total_bottles = 
(SELECT COUNT(*) FROM bottle
WHERE bottle.brand_id = entity.id
   OR bottle.bottler_id = entity.id
   OR EXISTS(SELECT FROM bottle_distiller WHERE bottle_distiller.distiller_id = entity.id AND bottle_distiller.bottle_id = bottle.id));
