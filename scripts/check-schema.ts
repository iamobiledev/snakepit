import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });
import {
  inspectConfiguredSchemaTargets,
  schemaDiagnosticMessage,
} from "./schema-readiness";

async function main() {
  const report = await inspectConfiguredSchemaTargets(process.env);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ready) {
    console.error(schemaDiagnosticMessage(report.diagnostic));
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.error(
    JSON.stringify({
      ready: false,
      diagnostic: "SCHEMA_CHECK_FAILED",
      targets: [],
    }),
  );
  process.exit(1);
});
