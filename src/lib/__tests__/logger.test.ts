import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../logger";

type Spies = {
  log: ReturnType<typeof vi.spyOn>;
  info: ReturnType<typeof vi.spyOn>;
  warn: ReturnType<typeof vi.spyOn>;
  error: ReturnType<typeof vi.spyOn>;
  debug: ReturnType<typeof vi.spyOn>;
};

let spies: Spies;

beforeEach(() => {
  spies = {
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    info: vi.spyOn(console, "info").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
    debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function lastPayload(spy: ReturnType<typeof vi.spyOn>) {
  const call = spy.mock.calls.at(-1);
  return JSON.parse(call![0] as string);
}

describe("logger routing", () => {
  it("sends info logs to console.log with structured fields", () => {
    logger.info("user.created", { userId: "u1" });
    const payload = lastPayload(spies.log);
    expect(payload).toMatchObject({
      level: "info",
      message: "user.created",
      userId: "u1",
    });
    expect(typeof payload.time).toBe("string");
  });

  it("routes warnings to console.warn and errors to console.error", () => {
    logger.warn("slow");
    logger.error("boom");
    expect(lastPayload(spies.warn)).toMatchObject({ level: "warn", message: "slow" });
    expect(lastPayload(spies.error)).toMatchObject({ level: "error", message: "boom" });
  });
});

describe("logger debug gating", () => {
  it("emits debug logs outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    logger.debug("trace");
    expect(spies.debug).toHaveBeenCalledTimes(1);
    expect(lastPayload(spies.debug)).toMatchObject({ level: "debug", message: "trace" });
  });

  it("suppresses debug logs in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    logger.debug("trace");
    expect(spies.debug).not.toHaveBeenCalled();
    // Falls through to console.log with the debug level payload.
    expect(lastPayload(spies.log)).toMatchObject({ level: "debug" });
  });
});

describe("logger sanitization", () => {
  it("redacts sensitive keys by name and by pattern", () => {
    logger.info("auth", {
      password: "hunter2",
      BETTER_AUTH_SECRET: "abc",
      apiKey: "sk-123",
      sessionToken: "t",
      userId: "safe",
    });
    const payload = lastPayload(spies.log);
    expect(payload.password).toBe("[redacted]");
    expect(payload.BETTER_AUTH_SECRET).toBe("[redacted]");
    expect(payload.apiKey).toBe("[redacted]");
    expect(payload.sessionToken).toBe("[redacted]");
    expect(payload.userId).toBe("safe");
  });

  it("handles calls with no fields", () => {
    logger.info("ping");
    const payload = lastPayload(spies.log);
    expect(payload).toMatchObject({ level: "info", message: "ping" });
  });
});
