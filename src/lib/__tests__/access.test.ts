import { describe, expect, it } from "vitest";
import {
  computeDocumentAccess,
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

  it("helpers reflect levels", () => {
    expect(canView("viewer")).toBe(true);
    expect(canView("editor")).toBe(true);
    expect(canView("none")).toBe(false);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
  });
});
