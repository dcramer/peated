CREATE TABLE "image_label_extraction" (
	"image_url" text NOT NULL,
	"version" varchar(64) NOT NULL,
	"extracted_identity" jsonb,
	"raw_label_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "image_label_extraction_image_url_version_pk" PRIMARY KEY("image_url","version")
);
