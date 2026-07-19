import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { shouldUsePgDriver } from "../src/db/create-db";
import {
  buildSchemaReadinessReport,
  isSchemaReady,
  REQUIRED_SCHEMA_INDEXES,
  resolveSchemaCheckTargets,
  type SchemaReadinessChecks,
  type SchemaReadinessDiagnostic,
  type SchemaReadinessReport,
  type SchemaTargetResult,
} from "../src/db/schema-readiness";

type DatabaseEnvironment = Readonly<Record<string, string | undefined>>;

type SchemaReadinessRow = {
  documents: string | null;
  workspace_members: string | null;
  document_versions: string | null;
  document_search_blocks: string | null;
  migration_journal: string | null;
  ownership_transfer_function: string | null;
  has_document_revision: boolean;
  has_auto_join_domain: boolean;
  has_vector: boolean;
  indexes: string[] | string;
};

const readinessQuery = sql`
  SELECT
    to_regclass('public.documents')::text AS documents,
    to_regclass('public.workspace_members')::text AS workspace_members,
    to_regclass('public.document_versions')::text AS document_versions,
    to_regclass('public.document_search_blocks')::text AS document_search_blocks,
    to_regclass('drizzle.__drizzle_migrations')::text AS migration_journal,
    to_regprocedure(
      'public.transfer_workspace_ownership(text,text,text)'
    )::text AS ownership_transfer_function,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'documents'
        AND column_name = 'revision'
    ) AS has_document_revision,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'workspaces'
        AND column_name = 'auto_join_domain'
    ) AS has_auto_join_domain,
    EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) AS has_vector,
    COALESCE(
      (
        SELECT jsonb_agg(indexname ORDER BY indexname)
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (${sql.join(
            REQUIRED_SCHEMA_INDEXES.map((name) => sql`${name}`),
            sql`, `,
          )})
      ),
      '[]'::jsonb
    ) AS indexes
`;

async function querySchemaReadiness(url: string): Promise<SchemaReadinessRow> {
  if (shouldUsePgDriver(url)) {
    const pool = new Pool({ connectionString: url });
    try {
      const result = await drizzlePg(pool).execute(readinessQuery);
      return result.rows[0] as SchemaReadinessRow;
    } finally {
      await pool.end();
    }
  }

  const client = neon(url);
  const result = await drizzleNeon(client).execute(readinessQuery);
  return result.rows[0] as SchemaReadinessRow;
}

function checksFromRow(row: SchemaReadinessRow): SchemaReadinessChecks {
  const indexes = Array.isArray(row.indexes)
    ? row.indexes
    : (JSON.parse(String(row.indexes)) as string[]);
  const missingIndexes = REQUIRED_SCHEMA_INDEXES.filter(
    (name) => !indexes.includes(name),
  );

  return {
    connected: true,
    coreSchemaReady: Boolean(
      row.documents &&
        row.workspace_members &&
        row.document_versions &&
        row.has_document_revision,
    ),
    searchSchemaReady: Boolean(
      row.document_search_blocks && row.has_vector,
    ),
    domainAccessSchemaReady: Boolean(
      row.has_auto_join_domain &&
        indexes.includes("workspaces_auto_join_domain_uidx"),
    ),
    ownershipSchemaReady: Boolean(
      row.ownership_transfer_function &&
        indexes.includes("workspace_members_single_owner_uidx"),
    ),
    migrationJournalReady: Boolean(row.migration_journal),
    missingIndexes,
  };
}

function unavailableChecks(): SchemaReadinessChecks {
  return {
    connected: false,
    coreSchemaReady: false,
    searchSchemaReady: false,
    domainAccessSchemaReady: false,
    ownershipSchemaReady: false,
    migrationJournalReady: false,
    missingIndexes: [...REQUIRED_SCHEMA_INDEXES],
  };
}

async function inspectTarget(
  target: ReturnType<typeof resolveSchemaCheckTargets>[number],
): Promise<SchemaTargetResult> {
  try {
    const checks = checksFromRow(await querySchemaReadiness(target.url));
    return {
      target: target.label,
      ready: isSchemaReady(checks),
      checks,
    };
  } catch {
    return {
      target: target.label,
      ready: false,
      checks: unavailableChecks(),
      error: "unavailable",
    };
  }
}

/**
 * Verify schema visibility through both the application and DDL endpoints.
 * The returned structure contains labels and readiness flags only—never URLs.
 */
export async function inspectConfiguredSchemaTargets(
  env: DatabaseEnvironment,
): Promise<SchemaReadinessReport> {
  const targets = resolveSchemaCheckTargets(env);
  const results = await Promise.all(targets.map(inspectTarget));
  return buildSchemaReadinessReport(results);
}

export function schemaDiagnosticMessage(
  diagnostic: SchemaReadinessDiagnostic,
): string {
  switch (diagnostic) {
    case "READY":
      return "All configured database targets expose the required schema.";
    case "NO_DATABASE_TARGET":
      return "DATABASE_URL or DATABASE_URL_UNPOOLED is required.";
    case "RUNTIME_SCHEMA_BEHIND_MIGRATION_TARGET":
      return "The migration target is ready, but the runtime target is not. DATABASE_URL and DATABASE_URL_UNPOOLED likely point to different databases or branches.";
    case "MIGRATION_SCHEMA_BEHIND_RUNTIME_TARGET":
      return "The runtime target is ready, but the migration target is not. DATABASE_URL and DATABASE_URL_UNPOOLED likely point to different databases or branches.";
    case "SCHEMA_INCOMPLETE":
      return "At least one configured database target is missing required schema objects.";
  }
}
