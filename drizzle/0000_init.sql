-- Enable search extensions (Neon / Postgres)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member', 'guest');
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');
CREATE TYPE "public"."file_access" AS ENUM('private', 'workspace', 'public');
CREATE TYPE "public"."document_visibility" AS ENUM('private', 'workspace', 'public');

CREATE TABLE "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL,
  CONSTRAINT "session_token_unique" UNIQUE("token")
);

CREATE TABLE "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE "workspaces" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "icon_url" text,
  "icon_blob_pathname" text,
  "created_by_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "workspace_members" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" "workspace_role" DEFAULT 'member' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "workspace_invitations" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "email" text NOT NULL,
  "role" "workspace_role" DEFAULT 'member' NOT NULL,
  "token" text NOT NULL,
  "status" "invitation_status" DEFAULT 'pending' NOT NULL,
  "invited_by_id" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "documents" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "parent_id" text,
  "title" text DEFAULT 'Untitled' NOT NULL,
  "public_slug" text,
  "visibility" "document_visibility" DEFAULT 'workspace' NOT NULL,
  "content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "plain_text_content" text DEFAULT '' NOT NULL,
  "breadcrumb_path" text DEFAULT '' NOT NULL,
  "cover_image_url" text,
  "cover_image_blob_pathname" text,
  "icon" text,
  "created_by_id" text NOT NULL,
  "updated_by_id" text,
  "published_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "search_vector" tsvector
);

CREATE TABLE "document_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "document_id" text NOT NULL,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "content_json" jsonb NOT NULL,
  "plain_text_content" text DEFAULT '' NOT NULL,
  "created_by_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "favorites" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "document_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "recently_viewed" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "document_id" text NOT NULL,
  "viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "files" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "uploaded_by_id" text NOT NULL,
  "document_id" text,
  "blob_url" text NOT NULL,
  "blob_pathname" text NOT NULL,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_size" integer NOT NULL,
  "access" "file_access" DEFAULT 'workspace' NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "documents" ADD CONSTRAINT "documents_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "files" ADD CONSTRAINT "files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "files" ADD CONSTRAINT "files_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");
CREATE UNIQUE INDEX "workspaces_slug_uidx" ON "workspaces" USING btree ("slug");
CREATE UNIQUE INDEX "workspace_members_ws_user_uidx" ON "workspace_members" USING btree ("workspace_id","user_id");
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");
CREATE UNIQUE INDEX "workspace_invitations_token_uidx" ON "workspace_invitations" USING btree ("token");
CREATE INDEX "workspace_invitations_email_idx" ON "workspace_invitations" USING btree ("email");
CREATE INDEX "workspace_invitations_expires_idx" ON "workspace_invitations" USING btree ("expires_at");
CREATE INDEX "documents_workspace_idx" ON "documents" USING btree ("workspace_id");
CREATE INDEX "documents_parent_idx" ON "documents" USING btree ("parent_id");
CREATE UNIQUE INDEX "documents_public_slug_uidx" ON "documents" USING btree ("public_slug");
CREATE INDEX "documents_updated_idx" ON "documents" USING btree ("updated_at");
CREATE INDEX "documents_title_trgm_idx" ON "documents" USING gin ("title" gin_trgm_ops);
CREATE INDEX "documents_search_vector_idx" ON "documents" USING gin ("search_vector");
CREATE UNIQUE INDEX "document_versions_doc_ver_uidx" ON "document_versions" USING btree ("document_id","version");
CREATE INDEX "document_versions_created_idx" ON "document_versions" USING btree ("created_at");
CREATE UNIQUE INDEX "favorites_user_doc_uidx" ON "favorites" USING btree ("user_id","document_id");
CREATE INDEX "favorites_user_idx" ON "favorites" USING btree ("user_id");
CREATE UNIQUE INDEX "recently_viewed_user_doc_uidx" ON "recently_viewed" USING btree ("user_id","document_id");
CREATE INDEX "recently_viewed_user_viewed_idx" ON "recently_viewed" USING btree ("user_id","viewed_at");
CREATE INDEX "files_workspace_idx" ON "files" USING btree ("workspace_id");
CREATE INDEX "files_document_idx" ON "files" USING btree ("document_id");
CREATE UNIQUE INDEX "files_blob_pathname_uidx" ON "files" USING btree ("blob_pathname");
CREATE INDEX "files_deleted_idx" ON "files" USING btree ("deleted_at");

-- Keep search_vector in sync on write (application also updates it)
CREATE OR REPLACE FUNCTION documents_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.breadcrumb_path, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.plain_text_content, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, breadcrumb_path, plain_text_content
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION documents_search_vector_update();
