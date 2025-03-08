-- First, drop the existing foreign key constraint
ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_parent_id_comments_id_fk";

-- Then recreate it with ON DELETE CASCADE
ALTER TABLE "comments" 
ADD CONSTRAINT "comments_parent_id_comments_id_fk" 
FOREIGN KEY ("parent_id") 
REFERENCES "comments"("id") 
ON DELETE CASCADE; 