import { afterEach, describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { canonicalizeAppUrl, getAppUrl } from "@/env/server";

const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL_ENV, ...overrides } as NodeJS.ProcessEnv;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV } as NodeJS.ProcessEnv;
});

describe("getAppUrl", () => {
  it("forces brand.siteUrl on Vercel Production even when env is a vercel.app alias", () => {
    setEnv({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://snakepit-mauve.vercel.app",
      BETTER_AUTH_URL: "https://snakepit-mauve.vercel.app",
      VERCEL_URL: "snakepit-mauve.vercel.app",
    });

    expect(getAppUrl()).toBe(brand.siteUrl);
    expect(getAppUrl()).toBe("https://backbeatnotes.com");
  });

  it("still returns brand.siteUrl on Production when BETTER_AUTH_URL is already correct", () => {
    setEnv({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://backbeatnotes.com",
      BETTER_AUTH_URL: "https://backbeatnotes.com",
    });

    expect(getAppUrl()).toBe(brand.siteUrl);
  });

  it("uses preview/env URL on Vercel Preview (does not force brand.siteUrl)", () => {
    setEnv({
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_APP_URL: undefined,
      BETTER_AUTH_URL: undefined,
      VERCEL_URL: "backbeatnotes-git-feature-motown.vercel.app",
    });

    expect(getAppUrl()).toBe(
      "https://backbeatnotes-git-feature-motown.vercel.app",
    );
  });

  it("uses configured localhost in development", () => {
    setEnv({
      VERCEL_ENV: undefined,
      VERCEL_URL: undefined,
      BETTER_AUTH_URL: undefined,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });

    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("builds invitation paths on the canonical Production host", () => {
    setEnv({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://snakepit-mauve.vercel.app",
    });

    const inviteUrl = `${getAppUrl()}/invitations/tok_test`;
    expect(inviteUrl).toBe("https://backbeatnotes.com/invitations/tok_test");
    expect(inviteUrl).not.toContain("vercel.app");
  });
});

describe("canonicalizeAppUrl", () => {
  it("rewrites alias hosts onto brand.siteUrl in Production", () => {
    setEnv({ VERCEL_ENV: "production" });

    expect(
      canonicalizeAppUrl(
        "https://snakepit-mauve.vercel.app/api/auth/verify-email?token=abc",
      ),
    ).toBe("https://backbeatnotes.com/api/auth/verify-email?token=abc");
  });

  it("leaves URLs unchanged outside Production", () => {
    setEnv({ VERCEL_ENV: "preview" });

    const url =
      "https://backbeatnotes-git-feature.vercel.app/api/auth/reset-password?token=xyz";
    expect(canonicalizeAppUrl(url)).toBe(url);
  });

  it("returns the original string when the input is not a valid URL", () => {
    setEnv({ VERCEL_ENV: "production" });
    expect(canonicalizeAppUrl("not a url")).toBe("not a url");
  });
});
