import { describe, it, expect } from "vitest";
import { canRoleAccessPath } from "@/lib/route-access";
import { isAuthorized } from "@/lib/authz";

describe("who may open which page", () => {
  it("Search Graves is open to Admin, Staff and Client", () => {
    for (const role of ["Admin", "Staff", "Client"]) {
      expect(canRoleAccessPath(role, "/dashboard/search")).toBe(true);
    }
    expect(canRoleAccessPath(undefined, "/dashboard/search")).toBe(false);
    expect(canRoleAccessPath("Visitor", "/dashboard/search")).toBe(false);
  });

  it("the User Log is Admin-only, in the page guard and in the API permission", () => {
    expect(canRoleAccessPath("Admin", "/dashboard/user-log")).toBe(true);
    expect(canRoleAccessPath("Staff", "/dashboard/user-log")).toBe(false);
    expect(canRoleAccessPath("Client", "/dashboard/user-log")).toBe(false);
    expect(isAuthorized("Admin", "userLogs")).toBe(true);
    expect(isAuthorized("Staff", "userLogs")).toBe(false);
    expect(isAuthorized("Client", "userLogs")).toBe(false);
  });
});
