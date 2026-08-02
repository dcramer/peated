CREATE TABLE "oauth_authorization_code" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code_digest" varchar(64) NOT NULL,
	"oauth_client_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp
);

CREATE TABLE "oauth_client" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"redirect_uris" text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "oauth_authorization_code" ADD CONSTRAINT "oauth_authorization_code_oauth_client_id_oauth_client_id_fk" FOREIGN KEY ("oauth_client_id") REFERENCES "public"."oauth_client"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "oauth_authorization_code" ADD CONSTRAINT "oauth_authorization_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "oauth_authorization_code_digest_unq" ON "oauth_authorization_code" USING btree ("code_digest");
CREATE INDEX "oauth_authorization_code_client_idx" ON "oauth_authorization_code" USING btree ("oauth_client_id");
CREATE INDEX "oauth_authorization_code_user_idx" ON "oauth_authorization_code" USING btree ("user_id");
CREATE INDEX "oauth_authorization_code_expires_idx" ON "oauth_authorization_code" USING btree ("expires_at");
CREATE UNIQUE INDEX "oauth_client_client_id_unq" ON "oauth_client" USING btree ("client_id");