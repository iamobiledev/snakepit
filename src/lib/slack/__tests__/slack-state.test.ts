import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStateToken, verifyStateToken } from "../state";

const TEST_SECRET = "unit-test-better-auth-secret-32chars!!";

vi.mock("@/env/server", () => ({
  getServerEnv: () => ({
    BETTER_AUTH_SECRET: TEST_SECRET,
  }),
}));

/** Mirrors the module's private signing scheme for crafting edge-case tokens. */
function signData(data: string): string {
  return createHmac("sha256", `slack-state:${TEST_SECRET}`)
    .update(data)
    .digest("base64url");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("slack OAuth state tokens", () => {
  it("round-trips an install payload", () => {
    const token = createStateToken({
      kind: "install",
      workspaceId: "ws1",
      userId: "u1",
    });
    const payload = verifyStateToken(token);
    expect(payload).toMatchObject({
      kind: "install",
      workspaceId: "ws1",
      userId: "u1",
    });
    expect(typeof payload!.exp).toBe("number");
  });

  it("round-trips a link payload without a workspace", () => {
    const token = createStateToken({ kind: "link", userId: "u2" });
    expect(verifyStateToken(token)).toMatchObject({
      kind: "link",
      userId: "u2",
    });
  });

  it("rejects a token with a tampered payload", () => {
    const token = createStateToken({ kind: "link", userId: "u1" });
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ kind: "link", userId: "attacker", exp: Date.now() + 1000 }),
    ).toString("base64url");
    expect(verifyStateToken(`${forged}.${signature}`)).toBeNull();
  });

  it("returns null for malformed tokens", () => {
    expect(verifyStateToken("")).toBeNull();
    expect(verifyStateToken("no-dot")).toBeNull();
    expect(verifyStateToken("only.")).toBeNull();
    expect(verifyStateToken(".only")).toBeNull();
  });

  it("returns null when a correctly-signed payload is not valid JSON", () => {
    const data = Buffer.from("not-json").toString("base64url");
    const token = `${data}.${signData(data)}`;
    expect(verifyStateToken(token)).toBeNull();
  });

  it("rejects expired tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createStateToken({ kind: "link", userId: "u1" });

    // Advance beyond the 10-minute TTL.
    vi.setSystemTime(new Date("2026-01-01T00:11:00Z"));
    expect(verifyStateToken(token)).toBeNull();
  });
});
