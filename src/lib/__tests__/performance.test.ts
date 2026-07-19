import { afterEach, describe, expect, it, vi } from "vitest";
import { measureServerOperation } from "../performance";
import { logger } from "../logger";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("measureServerOperation", () => {
  it("returns the work result and stays silent for fast operations", async () => {
    vi.stubEnv("SLOW_OPERATION_MS", "100000");
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});

    const result = await measureServerOperation("fast.op", async () => 123);

    expect(result).toBe(123);
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs a structured warning when the threshold is breached", async () => {
    vi.stubEnv("SLOW_OPERATION_MS", "1");
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});

    await measureServerOperation(
      "slow.op",
      async () => {
        await sleep(15);
        return "ok";
      },
      { workspaceId: "w1" },
    );

    expect(warn).toHaveBeenCalledTimes(1);
    const [message, fields] = warn.mock.calls[0];
    expect(message).toBe("performance.slow_operation");
    expect(fields).toMatchObject({ operation: "slow.op", workspaceId: "w1" });
    expect((fields as { durationMs: number }).durationMs).toBeGreaterThan(0);
  });

  it("falls back to the default threshold for invalid SLOW_OPERATION_MS", async () => {
    vi.stubEnv("SLOW_OPERATION_MS", "not-a-number");
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});

    // Well under the 250ms default, so no warning is emitted.
    await measureServerOperation("quick.op", async () => {
      await sleep(1);
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it("logs the failure and rethrows when work throws", async () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => {});
    const boom = new Error("db exploded");

    await expect(
      measureServerOperation("failing.op", async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    expect(error).toHaveBeenCalledTimes(1);
    const [message, fields] = error.mock.calls[0];
    expect(message).toBe("performance.operation_failed");
    expect(fields).toMatchObject({ operation: "failing.op", error: "db exploded" });
  });

  it("stringifies non-Error throwables in the failure log", async () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => {});

    await expect(
      measureServerOperation("failing.op", async () => {
        throw "plain string failure";
      }),
    ).rejects.toBe("plain string failure");

    const [, fields] = error.mock.calls[0];
    expect((fields as { error: string }).error).toBe("plain string failure");
  });
});
