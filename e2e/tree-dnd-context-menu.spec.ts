import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Sidebar page-tree interactions:
 * - drag & drop a page onto another page to nest it as a sub-page
 * - Notion-style right-click context menu on tree rows
 * - "Move to" dialog (move back to top level)
 *
 * Requires a seeded local database (`pnpm db:seed`) and E2E_HAS_DATABASE=1,
 * like the other DB-backed specs.
 */

const DEMO_EMAIL = process.env.SEED_USER_EMAIL ?? "demo@backbeatnotes.local";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "BackBeatNotesDemo123!";

const hasDb =
  Boolean(process.env.E2E_HAS_DATABASE) ||
  Boolean(process.env.PLAYWRIGHT_BASE_URL);

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(DEMO_EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/app/);
}

async function createPage(page: Page, title: string) {
  const previousUrl = page.url();
  await page.getByRole("button", { name: /new page/i }).first().click();
  // Wait for the *new* page's URL — the previous one may already be /docs/.
  await page.waitForURL(
    (url) => url.toString() !== previousUrl && url.pathname.includes("/docs/"),
  );
  // During instant navigation the previous (hidden) editor stays mounted.
  await page
    .getByLabel("Document title")
    .filter({ visible: true })
    .fill(title);
  // Autosave; wait until the sidebar shows the renamed row.
  await expect(
    page.locator("aside").getByRole("link", { name: title }),
  ).toBeVisible({ timeout: 15_000 });
}

function sidebarRow(page: Page, title: string): Locator {
  // The draggable row <div> wrapping the sidebar page link.
  return page
    .locator("aside div[draggable]")
    .filter({ has: page.getByRole("link", { name: title }) });
}

test.describe.serial("sidebar tree drag & drop and context menu", () => {
  test.skip(!hasDb, "Requires a seeded database (E2E_HAS_DATABASE=1)");

  const runId = Date.now().toString(36);
  const parentTitle = `DnD Parent ${runId}`;
  const childTitle = `DnD Child ${runId}`;

  test("drag a page onto another page to nest it", async ({ page }) => {
    await signIn(page);
    await page.goto("/app");
    await page.getByRole("link", { name: "My Workspace" }).first().click();
    await page.waitForURL(/\/app\/[^/]+$/);

    await createPage(page, parentTitle);
    await createPage(page, childTitle);

    const source = sidebarRow(page, childTitle);
    const target = sidebarRow(page, parentTitle);
    await source.dragTo(target);

    await expect(
      page.getByText(`Moved to "${parentTitle}"`).first(),
    ).toBeVisible();

    // The child now renders nested inside the parent's treeitem.
    const parentItem = page
      .locator('aside [role="treeitem"]')
      .filter({ has: page.getByRole("link", { name: parentTitle }) });
    await expect(
      parentItem.getByRole("link", { name: childTitle }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("right-click shows the Notion-style menu and Move to returns the page to top level", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/app");
    await page.getByRole("link", { name: "My Workspace" }).first().click();
    await page.waitForURL(/\/app\/[^/]+$/);

    // The child is nested under the (collapsed) parent — expand it first.
    await page
      .locator('aside [role="treeitem"]')
      .filter({ has: page.getByRole("link", { name: parentTitle }) })
      .getByRole("button", { name: "Expand" })
      .first()
      .click();

    // Right-click the nested child from the previous test.
    await sidebarRow(page, childTitle).click({ button: "right" });

    for (const item of [
      "Add to favorites",
      "Copy link",
      "Duplicate",
      "Rename",
      "Move to",
      "Move to trash",
      "Open in new tab",
    ]) {
      await expect(
        page.getByRole("menuitem", { name: item, exact: true }),
      ).toBeVisible();
    }
    await expect(page.getByText(/last edited by/i)).toBeVisible();

    // Move the page back to the top level via the Move-to dialog.
    await page.getByRole("menuitem", { name: "Move to", exact: true }).click();
    await expect(
      page.getByRole("dialog").getByText(new RegExp(`Move .${childTitle}. to`)),
    ).toBeVisible();
    await page.getByRole("button", { name: /top level of/i }).click();

    await expect(page.getByText(/moved to "/i).first()).toBeVisible();
    const parentItem = page
      .locator('aside [role="treeitem"]')
      .filter({ has: page.getByRole("link", { name: parentTitle }) });
    await expect(
      parentItem.getByRole("link", { name: childTitle }),
    ).toBeHidden({ timeout: 15_000 });
    await expect(
      page.locator("aside").getByRole("link", { name: childTitle }),
    ).toBeVisible();
  });

  test("clean up: trash the test pages from the context menu", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/app");
    await page.getByRole("link", { name: "My Workspace" }).first().click();
    await page.waitForURL(/\/app\/[^/]+$/);

    for (const title of [childTitle, parentTitle]) {
      await sidebarRow(page, title).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Move to trash" }).click();
      await expect(
        page.locator("aside").getByRole("link", { name: title }),
      ).toBeHidden({ timeout: 15_000 });
    }
  });
});
