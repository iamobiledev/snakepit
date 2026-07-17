import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSlackConfigured, getSlackStatus } from "../status";

const getConnectionForWorkspace = vi.fn();

vi.mock("../service", () => ({
  getConnectionForWorkspace: (workspaceId: string) =>
    getConnectionForWorkspace(workspaceId),
}));

const SLACK_ENV = [
  "SLACK_CLIENT_ID",
  "SLACK_CLIENT_SECRET",
  "SLACK_SIGNING_SECRET",
  "SLACK_TOKEN_ENCRYPTION_KEY",
] as const;

function configureSlack() {
  for (const key of SLACK_ENV) vi.stubEnv(key, "x");
}

beforeEach(() => {
  getConnectionForWorkspace.mockReset();
  for (const key of SLACK_ENV) vi.stubEnv(key, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSlackConfigured", () => {
  it("is true only when all four credentials are present", () => {
    configureSlack();
    expect(isSlackConfigured()).toBe(true);
  });

  it("is false when any credential is missing", () => {
    for (const missing of SLACK_ENV) {
      configureSlack();
      vi.stubEnv(missing, "");
      expect(isSlackConfigured()).toBe(false);
    }
  });
});

describe("getSlackStatus", () => {
  it("reports unconfigured without touching the service layer", async () => {
    const status = await getSlackStatus("ws1");
    expect(status).toEqual({ configured: false, connected: false, teamName: null });
    expect(getConnectionForWorkspace).not.toHaveBeenCalled();
  });

  it("reports connected with the team name when a connection exists", async () => {
    configureSlack();
    getConnectionForWorkspace.mockResolvedValue({ slackTeamName: "Acme" });

    const status = await getSlackStatus("ws1");
    expect(status).toEqual({ configured: true, connected: true, teamName: "Acme" });
    expect(getConnectionForWorkspace).toHaveBeenCalledWith("ws1");
  });

  it("reports configured-but-disconnected when there is no connection", async () => {
    configureSlack();
    getConnectionForWorkspace.mockResolvedValue(null);

    const status = await getSlackStatus("ws1");
    expect(status).toEqual({ configured: true, connected: false, teamName: null });
  });
});
