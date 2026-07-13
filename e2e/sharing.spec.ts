import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

/**
 * End-to-end coverage of the Notion-style page sharing system:
 * - Share popover: invite by email with an access level
 * - direct shares grant access to non-members ("Shared" sidebar section)
 * - access level changes (Can view ↔ Can edit) take effect
 * - Remove → request-access screen
 * - General access: "Only people invited" vs "Everyone at {workspace}"
 * - pending invitations for emails without an account
 *
 * Requires a seeded local database (`pnpm db:seed`) and E2E_HAS_DATABASE=1.
 */

const DEMO_EMAIL = process.env.SEED_USER_EMAIL ?? "demo@docloom.local";
const OUTSIDER_EMAIL =
  process.env.SEED_OUTSIDER_EMAIL ?? "teammate@docloom.local";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "DocloomDemo123!";
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR ?? "";

const hasDb =
  Boolean(process.env.E2E_HAS_DATABASE) ||
  Boolean(process.env.PLAYWRIGHT_BASE_URL);

async function shot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: false,
  });
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/app/);
}

async function openSharePopover(page: Page) {
  await page.getByRole("button", { name: /^Share/ }).click();
  await expect(page.getByRole("tab", { name: "Share" })).toBeVisible();
}

test.describe.serial("page sharing", () => {
  test.skip(!hasDb, "Requires a seeded database (E2E_HAS_DATABASE=1)");

  const runId = Date.now().toString(36);
  const docTitle = `Timeclock desk mount ${runId}`;
  const strangerEmail = `stranger-${runId}@example.com`;
  let docUrl = "";

  test("owner creates a page and the Share popover shows themselves with full access", async ({
    page,
  }) => {
    await signIn(page, DEMO_EMAIL);
    await page.goto("/app");
    await page.getByRole("link", { name: "My Workspace" }).first().click();
    await page.waitForURL(/\/app\/[^/]+$/);
    await page.getByRole("button", { name: /new page/i }).first().click();
    await page.waitForURL(/\/docs\//);
    docUrl = page.url();

    await page.getByLabel("Document title").fill(docTitle);
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("the part should be 70mm wide");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await openSharePopover(page);
    // Invite input with the Notion placeholder.
    await expect(
      page.getByPlaceholder("Email or group, separated by commas"),
    ).toBeVisible();
    // The owner row: "(You)" + Full access.
    await expect(page.getByText("(You)")).toBeVisible();
    await expect(page.getByText("Full access").first()).toBeVisible();
    // General access defaults to everyone in the workspace.
    await expect(page.getByText("Everyone at My Workspace")).toBeVisible();
    await shot(page, "10-share-popover");
  });

  test("invite a teammate with 'Can view'", async ({ page }) => {
    await signIn(page, DEMO_EMAIL);
    await page.goto(docUrl);
    await openSharePopover(page);

    const input = page.getByPlaceholder("Email or group, separated by commas");
    await input.fill(OUTSIDER_EMAIL);
    // Pick the access level from the inline dropdown (defaults Full access).
    await page.getByRole("button", { name: "Access level for invitees" }).click();
    await page.getByRole("menuitem", { name: "Can view" }).click();
    await page.getByRole("button", { name: "Invite", exact: true }).click();

    await expect(page.getByText(/shared with 1 person/i)).toBeVisible({
      timeout: 10_000,
    });
    // The teammate appears in the people list with their level.
    await expect(page.getByText("Taylor Teammate")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Change Taylor Teammate's access/i }),
    ).toContainText("Can view");
    await shot(page, "11-invited-teammate");
  });

  test("teammate sees the page in 'Shared' and it is read-only", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, OUTSIDER_EMAIL);

    // Sidebar "Shared" section lists the page (teammate isn't a member).
    const nav = page.getByRole("navigation", { name: "Documents" });
    await expect(nav.getByText("Shared", { exact: true })).toBeVisible();
    await nav.getByText(docTitle).click();
    await page.waitForURL(/\/docs\//);

    // Content is visible but not editable (Can view).
    await expect(page.getByText("the part should be 70mm wide")).toBeVisible();
    await expect(page.locator(".ProseMirror")).toHaveAttribute(
      "contenteditable",
      "false",
    );

    // Their Share popover is read-only: no invite input, levels as text.
    await openSharePopover(page);
    await expect(
      page.getByPlaceholder("Email or group, separated by commas"),
    ).toHaveCount(0);
    await expect(page.getByText("(You)")).toBeVisible();
    await shot(page, "12-teammate-shared-view");
    await context.close();
  });

  test("upgrading to 'Can edit' lets the teammate type", async ({
    page,
    browser,
  }) => {
    await signIn(page, DEMO_EMAIL);
    await page.goto(docUrl);
    await openSharePopover(page);
    await page
      .getByRole("button", { name: /Change Taylor Teammate's access/i })
      .click();
    await page.getByRole("menuitem", { name: "Can edit" }).click();
    await expect(
      page.getByRole("button", { name: /Change Taylor Teammate's access/i }),
    ).toContainText("Can edit", { timeout: 10_000 });

    const context = await browser.newContext();
    const teammate = await context.newPage();
    await signIn(teammate, OUTSIDER_EMAIL);
    await teammate.goto(docUrl);
    await expect(teammate.locator(".ProseMirror")).toHaveAttribute(
      "contenteditable",
      "true",
    );
    const editor = teammate.locator(".ProseMirror");
    await editor.click();
    await teammate.keyboard.press("ControlOrMeta+End");
    await teammate.keyboard.press("Enter");
    await teammate.keyboard.type(`the holes should be 5mm wide ${runId}`);
    await expect(teammate.getByText("Saved", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await context.close();
  });

  test("General access switches to 'Only people invited'", async ({
    page,
  }) => {
    await signIn(page, DEMO_EMAIL);
    await page.goto(docUrl);
    await openSharePopover(page);
    await page.getByRole("button", { name: "Change general access" }).click();
    await page
      .getByRole("menuitem", { name: /Only people invited/i })
      .click();
    await expect(
      page.getByText(/Only invited people can open this page now/i),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: "Change general access" }),
    ).toContainText("Only people invited");
    await shot(page, "13-only-people-invited");
  });

  test("teammate keeps access via their direct share; removal locks them out", async ({
    page,
    browser,
  }) => {
    // Direct share still works while the page is invite-only.
    const context = await browser.newContext();
    const teammate = await context.newPage();
    await signIn(teammate, OUTSIDER_EMAIL);
    await teammate.goto(docUrl);
    await expect(
      teammate.getByText("the part should be 70mm wide"),
    ).toBeVisible();

    // Owner removes the teammate.
    await signIn(page, DEMO_EMAIL);
    await page.goto(docUrl);
    await openSharePopover(page);
    await page
      .getByRole("button", { name: /Change Taylor Teammate's access/i })
      .click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await expect(page.getByText(/Removed Taylor Teammate's access/i)).toBeVisible(
      { timeout: 10_000 },
    );

    // The teammate now gets the request-access screen — no content leak.
    await teammate.goto(docUrl);
    await expect(teammate.getByText("You need access")).toBeVisible();
    await expect(teammate.locator("body")).not.toContainText(docTitle);
    await shot(teammate, "14-removed-request-access");
    await context.close();
  });

  test("inviting an email without an account creates a pending invitation", async ({
    page,
  }) => {
    await signIn(page, DEMO_EMAIL);
    await page.goto(docUrl);
    await openSharePopover(page);
    const input = page.getByPlaceholder("Email or group, separated by commas");
    await input.fill(strangerEmail);
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(page.getByText(/invitation sent to/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(strangerEmail, { exact: true })).toBeVisible();
    await expect(page.getByText("Pending invitation")).toBeVisible();
    await shot(page, "15-pending-invitation");

    // Revoke it again.
    await page
      .getByRole("button", { name: `Manage invitation for ${strangerEmail}` })
      .click();
    await page.getByRole("menuitem", { name: "Revoke invitation" }).click();
    await expect(page.getByText("Pending invitation")).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test("invalid emails show inline validation", async ({ page }) => {
    await signIn(page, DEMO_EMAIL);
    await page.goto(docUrl);
    await openSharePopover(page);
    const input = page.getByPlaceholder("Email or group, separated by commas");
    await input.fill("not-an-email");
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(page.getByText(/Not a valid email/i)).toBeVisible();
  });
});
