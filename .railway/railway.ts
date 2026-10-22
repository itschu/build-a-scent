import { defineRailway, github, project, service, volume } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "build-a-scent";
export default defineRailway(() => {
  // Uploaded images (UPLOADS_DIR=/data); see src/server/storage.ts.
  const uploads = volume("build-a-scent-volume", { region: "asia-southeast1-eqsg3a", sizeMB: 5000 });

  const buildAScent = service("build-a-scent", {
    source: github("itschu/build-a-scent", { branch: "main", checkSuites: false }),
    build: { buildCommand: "pnpm build", buildEnvironment: "V3", builder: "RAILPACK" },
    start: "pnpm start",
    healthcheck: "/api/health",
    healthcheckTimeout: 60,
    preDeploy: "pnpm db:migrate",
    // A volume attaches to one instance, so the app runs as a single replica.
    replicas: { "asia-southeast1-eqsg3a": 1 },
    volumeMounts: { "/data": uploads },
  });

  // Background jobs (pnpm jobs:run): runs every 5 minutes and exits. Shares the app's
  // variables via ${{build-a-scent.*}} references; the app service runs migrations.
  const jobs = service("jobs", {
    source: github("itschu/build-a-scent", { branch: "main", checkSuites: false }),
    build: { buildCommand: "echo 'jobs run from source with tsx; no build needed'", buildEnvironment: "V3", builder: "RAILPACK" },
    start: "pnpm jobs:run",
    deploy: { cronSchedule: "*/5 * * * *", restartPolicyType: "NEVER" },
    replicas: { "asia-southeast1-eqsg3a": 1 },
  });

  return project("vibrant-youthfulness", {
    variables: { managed: false },
    resources: [buildAScent, uploads, jobs],
  });
});
