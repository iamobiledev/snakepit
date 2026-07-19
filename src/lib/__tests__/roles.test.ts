import { describe, expect, it } from "vitest";
import {
  roleAtLeast,
  canEditDocuments,
  canManageWorkspace,
  canInvite,
  type WorkspaceRole,
} from "../roles";

const ROLES: WorkspaceRole[] = ["guest", "member", "admin", "owner"];

describe("roleAtLeast", () => {
  it("treats every role as meeting itself", () => {
    for (const role of ROLES) {
      expect(roleAtLeast(role, role)).toBe(true);
    }
  });

  it("orders guest < member < admin < owner", () => {
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("admin", "member")).toBe(true);
    expect(roleAtLeast("member", "guest")).toBe(true);

    expect(roleAtLeast("guest", "member")).toBe(false);
    expect(roleAtLeast("member", "admin")).toBe(false);
    expect(roleAtLeast("admin", "owner")).toBe(false);
  });
});

describe("canEditDocuments", () => {
  it("allows member and above, denies guest", () => {
    expect(canEditDocuments("guest")).toBe(false);
    expect(canEditDocuments("member")).toBe(true);
    expect(canEditDocuments("admin")).toBe(true);
    expect(canEditDocuments("owner")).toBe(true);
  });
});

describe("canManageWorkspace", () => {
  it("allows admin and owner only", () => {
    expect(canManageWorkspace("guest")).toBe(false);
    expect(canManageWorkspace("member")).toBe(false);
    expect(canManageWorkspace("admin")).toBe(true);
    expect(canManageWorkspace("owner")).toBe(true);
  });
});

describe("canInvite", () => {
  it("allows admin and owner only", () => {
    expect(canInvite("guest")).toBe(false);
    expect(canInvite("member")).toBe(false);
    expect(canInvite("admin")).toBe(true);
    expect(canInvite("owner")).toBe(true);
  });
});
