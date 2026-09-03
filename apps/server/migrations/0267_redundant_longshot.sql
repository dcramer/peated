CREATE TABLE "review_tag" (
	"review_id" bigint NOT NULL,
	"tag" varchar(64) NOT NULL,
	CONSTRAINT "review_tag_review_id_tag_pk" PRIMARY KEY("review_id","tag")
);

ALTER TABLE "review_tag" ADD CONSTRAINT "review_tag_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "review_tag" ADD CONSTRAINT "review_tag_tag_tag_name_fk" FOREIGN KEY ("tag") REFERENCES "public"."tag"("name") ON DELETE cascade ON UPDATE cascade;