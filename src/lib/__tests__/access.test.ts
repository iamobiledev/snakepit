import { describe, expect, it } from "vitest";
import {
  computeDocumentAccess,
  canManageWikiLock,
  canView,
  canEdit,
} from "@/lib/documents/access";
import type { WorkspaceRole } from "@/lib/roles";

/**
 * Security-sensitive: the full access decision matrix.
 * Personal notebooks are enforced by membership (single-member workspace),
 * so the matrix covers roles × visibility × creator × archived.
 */
describe("computeDocumentAccess", () => {
  const roles: WorkspaceRole[] = ["owner", "admin", "member", "guest"];

  it("denies everything to non-members", () => {
    for (const visibility of ["private", "workspace", "public"] as const) {
      expect(
        computeDocumentAccess({
          visibility,
          isCreator: false,
          membershipRole: null,
          archived: false,
        }),
      ).toBe("none");
    }
  });

  it("non-members get no access even as creator (revoked membership)", () => {
    expect(
      computeDocumentAccess({
        visibility: "workspace",
        isCreator: true,
        membershipRole: null,
        archived: false,
      }),
    ).toBe("none");
  });

  it("workspace-visible docs: guests view, members+ edit", () => {
    expect(
      computeDocumentAccess({
        visibility: "workspace",
        isCreator: false,
        membershipRole: "guest",
        archived: false,
      }),
    ).toBe("viewer");
    for (const role of ["member", "admin", "owner"] as const) {
      expect(
        computeDocumentAccess({
          visibility: "workspace",
          isCreator: false,
          membershipRole: role,
          archived: false,
        }),
      ).toBe("editor");
    }
  });

  it("private docs are creator-only, even for admins/owners", () => {
    for (const role of roles) {
      expect(
        computeDocumentAccess({
          visibility: "private",
          isCreator: false,
          membershipRole: role,
          archived: false,
        }),
      ).toBe("none");
    }
    expect(
      computeDocumentAccess({
        visibility: "private",
        isCreator: true,
        membershipRole: "member",
        archived: false,
      }),
    ).toBe("editor");
  });

  it("public docs behave like workspace docs for members", () => {
    expect(
      computeDocumentAccess({
        visibility: "public",
        isCreator: false,
        membershipRole: "member",
        archived: false,
      }),
    ).toBe("editor");
    expect(
      computeDocumentAccess({
        visibility: "public",
        isCreator: false,
        membershipRole: "guest",
        archived: false,
      }),
    ).toBe("viewer");
  });

  it("trashed docs are read-only for everyone", () => {
    for (const role of roles) {
      const access = computeDocumentAccess({
        visibility: "workspace",
        isCreator: true,
        membershipRole: role,
        archived: true,
      });
      expect(access).toBe("viewer");
    }
  });

  it("locked wikis: members demoted to viewer; workspace admins/owners keep editor", () => {
    const base = {
      visibility: "workspace" as const,
      isCreator: false,
      archived: false,
      docType: "wiki" as const,
      locked: true,
    };
    expect(
      computeDocumentAccess({ ...base, membershipRole: "member" }),
    ).toBe("viewer");
    expect(
      computeDocumentAccess({ ...base, membershipRole: "guest" }),
    ).toBe("viewer");
    expect(
      computeDocumentAccess({ ...base, membershipRole: "admin" }),
    ).toBe("editor");
    expect(
      computeDocumentAccess({ ...base, membershipRole: "owner" }),
    ).toBe("editor");
    // Creator status does not bypass the lock.
    expect(
      computeDocumentAccess({
        ...base,
        isCreator: true,
        membershipRole: "member",
      }),
    ).toBe("viewer");
  });

  it("locked wikis: platform admins keep editor even as workspace members", () => {
    const base = {
      visibility: "workspace" as const,
      isCreator: false,
      archived: false,
      docType: "wiki" as const,
      locked: true,
      membershipRole: "member" as const,
    };
    expect(computeDocumentAccess({ ...base, platformRole: "admin" })).toBe(
      "editor",
    );
    expect(computeDocumentAccess({ ...base, platformRole: "developer" })).toBe(
      "viewer",
    );
    // Platform admins still need workspace membership.
    expect(
      computeDocumentAccess({
        ...base,
        membershipRole: null,
        platformRole: "admin",
      }),
    ).toBe("none");
  });

  it("unlocked wikis and locked regular docs behave normally", () => {
    expect(
      computeDocumentAccess({
        visibility: "workspace",
        isCreator: false,
        membershipRole: "member",
        archived: false,
        docType: "wiki",
        locked: false,
      }),
    ).toBe("editor");
    // Lock flag is ignored for non-wiki docs (defensive).
    expect(
      computeDocumentAccess({
        visibility: "workspace",
        isCreator: false,
        membershipRole: "member",
        archived: false,
        docType: "doc",
        locked: true,
      }),
    ).toBe("editor");
  });

  it("canManageWikiLock: workspace admins/owners and platform admins only", () => {
    expect(canManageWikiLock({ membershipRole: "owner" })).toBe(true);
    expect(canManageWikiLock({ membershipRole: "admin" })).toBe(true);
    expect(canManageWikiLock({ membershipRole: "member" })).toBe(false);
    expect(
      canManageWikiLock({ membershipRole: "member", platformRole: "admin" }),
    ).toBe(true);
    expect(
      canManageWikiLock({ membershipRole: null, platformRole: "admin" }),
    ).toBe(false);
  });

  it("helpers reflect levels", () => {
    expect(canView("viewer")).toBe(true);
    expect(canView("editor")).toBe(true);
    expect(canView("none")).toBe(false);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
  });
});
