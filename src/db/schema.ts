import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/** tsvector custom type for full-text search */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
  "guest",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export const fileAccessEnum = pgEnum("file_access", [
  "private",
  "workspace",
  "public",
]);

export const documentVisibilityEnum = pgEnum("document_visibility", [
  "private",
  "workspace",
  "public",
]);

/* -------------------------------------------------------------------------- */
/* Better Auth core tables                                                     */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Workspaces                                                                  */
/* -------------------------------------------------------------------------- */

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    iconUrl: text("icon_url"),
    iconBlobPathname: text("icon_blob_pathname"),
    /**
     * Personal notebooks are single-member workspaces provisioned per user.
     * They can never be shared: invitations and membership changes are
     * rejected server-side for personal workspaces.
     */
    isPersonal: boolean("is_personal").notNull().default(false),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("workspaces_slug_uidx").on(t.slug),
    uniqueIndex("workspaces_personal_owner_uidx")
      .on(t.createdById)
      .where(sql`${t.isPersonal}`),
  ],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("workspace_members_ws_user_uidx").on(t.workspaceId, t.userId),
    index("workspace_members_user_idx").on(t.userId),
  ],
);

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: workspaceRoleEnum("role").notNull().default("member"),
    token: text("token").notNull(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    invitedById: text("invited_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("workspace_invitations_token_uidx").on(t.token),
    index("workspace_invitations_email_idx").on(t.email),
    index("workspace_invitations_expires_idx").on(t.expiresAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    title: text("title").notNull().default("Untitled"),
    /** Stable public slug — used for /p/[slug] routes */
    publicSlug: text("public_slug"),
    visibility: documentVisibilityEnum("visibility")
      .notNull()
      .default("workspace"),
    /** TipTap JSON document */
    contentJson: jsonb("content_json").$type<Record<string, unknown>>().notNull().default({}),
    /** Normalized plain text for search */
    plainTextContent: text("plain_text_content").notNull().default(""),
    /** Breadcrumb path string for search (e.g. "Engineering / API / Auth") */
    breadcrumbPath: text("breadcrumb_path").notNull().default(""),
    coverImageUrl: text("cover_image_url"),
    coverImageBlobPathname: text("cover_image_blob_pathname"),
    icon: text("icon"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    updatedById: text("updated_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Weighted FTS vector — maintained via trigger / application update */
    searchVector: tsvector("search_vector"),
  },
  (t) => [
    index("documents_workspace_idx").on(t.workspaceId),
    index("documents_parent_idx").on(t.parentId),
    uniqueIndex("documents_public_slug_uidx").on(t.publicSlug),
    index("documents_updated_idx").on(t.updatedAt),
    index("documents_title_trgm_idx").using(
      "gin",
      sql`${t.title} gin_trgm_ops`,
    ),
    index("documents_search_vector_idx").using("gin", t.searchVector),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    contentJson: jsonb("content_json").$type<Record<string, unknown>>().notNull(),
    plainTextContent: text("plain_text_content").notNull().default(""),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("document_versions_doc_ver_uidx").on(t.documentId, t.version),
    index("document_versions_created_idx").on(t.createdAt),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("favorites_user_doc_uidx").on(t.userId, t.documentId),
    index("favorites_user_idx").on(t.userId),
  ],
);

export const recentlyViewed = pgTable(
  "recently_viewed",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("recently_viewed_user_doc_uidx").on(t.userId, t.documentId),
    index("recently_viewed_user_viewed_idx").on(t.userId, t.viewedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Files (Vercel Blob metadata)                                                */
/* -------------------------------------------------------------------------- */

export const files = pgTable(
  "files",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    uploadedById: text("uploaded_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    documentId: text("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    blobUrl: text("blob_url").notNull(),
    blobPathname: text("blob_pathname").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    access: fileAccessEnum("access").notNull().default("workspace"),
    /** Soft-delete; cron / explicit purge removes Blob when unreferenced */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("files_workspace_idx").on(t.workspaceId),
    index("files_document_idx").on(t.documentId),
    uniqueIndex("files_blob_pathname_uidx").on(t.blobPathname),
    index("files_deleted_idx").on(t.deletedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                   */
/* -------------------------------------------------------------------------- */

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(workspaceMembers),
}));

export const workspaceRelations = relations(workspaces, ({ many, one }) => ({
  members: many(workspaceMembers),
  documents: many(documents),
  invitations: many(workspaceInvitations),
  createdBy: one(user, {
    fields: [workspaces.createdById],
    references: [user.id],
  }),
}));

export const documentRelations = relations(documents, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [documents.workspaceId],
    references: [workspaces.id],
  }),
  createdBy: one(user, {
    fields: [documents.createdById],
    references: [user.id],
  }),
  versions: many(documentVersions),
  files: many(files),
}));

export type User = typeof user.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type FileRecord = typeof files.$inferSelect;
export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect;
