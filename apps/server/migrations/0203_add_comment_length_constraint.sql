-- Add length constraint to comment field
ALTER TABLE "comments" 
  ALTER COLUMN "comment" TYPE varchar(2000); 