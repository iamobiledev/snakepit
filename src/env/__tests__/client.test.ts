import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientEnv } from "@/env/client";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getClientEnv", () => {
  it("returns the parsed public env when values are valid", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://backbeatnotes.com");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");

    expect(getClientEnv()).toEqual({
      NEXT_PUBLIC_APP_URL: "https://backbeatnotes.com",
      NEXT_PUBLIC_VERCEL_ENV: "production",
    });
  });

  it("allows an absent optional NEXT_PUBLIC_VERCEL_ENV", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", undefined);

    expect(getClientEnv()).toEqual({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });
  });

  it("throws with a descriptive message when the app URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(() => getClientEnv()).toThrow(/Invalid client environment variables/);
  });

  it("throws when the app URL is not a valid URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "not-a-url");
    expect(() => getClientEnv()).toThrow(/Invalid client environment variables/);
  });

  it("throws when NEXT_PUBLIC_VERCEL_ENV is not an allowed value", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://backbeatnotes.com");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "staging");
    expect(() => getClientEnv()).toThrow(/Invalid client environment variables/);
  });
});
