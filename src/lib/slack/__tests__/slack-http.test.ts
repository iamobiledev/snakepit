import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifySlackRequest } from "../http";
import { computeSlackSignature } from "../verify";
import { resetRateLimits } from "@/lib/rate-limit";

const signingSecretHolder = { value: "test-slack-signing-secret" as string | undefined };

vi.mock("@/env/server", () => ({
  getServerEnv: () => ({ SLACK_SIGNING_SECRET: signingSecretHolder.value }),
}));

function signedRequest(rawBody: string, opts?: { timestamp?: string; signature?: string }) {
  const timestamp = opts?.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature =
    opts?.signature ??
    computeSlackSignature({
      signingSecret: signingSecretHolder.value!,
      timestamp,
      rawBody,
    });
  return new Request("https://app.example.com/api/slack/events", {
    method: "POST",
    headers: {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signature,
    },
    body: rawBody,
  });
}

beforeEach(() => {
  signingSecretHolder.value = "test-slack-signing-secret";
  resetRateLimits();
});

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
});

describe("verifySlackRequest", () => {
  it("returns the raw body for a valid, signed request", async () => {
    const rawBody = "payload=hello";
    const result = await verifySlackRequest(signedRequest(rawBody), "events");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rawBody).toBe(rawBody);
  });

  it("responds 503 when Slack is not configured", async () => {
    signingSecretHolder.value = undefined;
    const req = signedRequest("x", {
      timestamp: String(Math.floor(Date.now() / 1000)),
      signature: "v0=unused",
    });
    const result = await verifySlackRequest(req, "events");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
      await expect(result.response.json()).resolves.toMatchObject({
        error: expect.stringContaining("not configured"),
      });
    }
  });

  it("responds 401 for an invalid signature", async () => {
    const req = signedRequest("payload=hello", { signature: "v0=deadbeef" });
    const result = await verifySlackRequest(req, "events");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("responds 401 for a stale (replayed) timestamp", async () => {
    const stale = String(Math.floor(Date.now() / 1000) - 60 * 10);
    const result = await verifySlackRequest(
      signedRequest("payload=hello", { timestamp: stale }),
      "events",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("responds 429 once the per-route rate limit is exceeded", async () => {
    let last = await verifySlackRequest(signedRequest("body-0"), "commands");
    for (let i = 1; i < 121; i++) {
      last = await verifySlackRequest(signedRequest(`body-${i}`), "commands");
    }
    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.response.status).toBe(429);
  });
});
