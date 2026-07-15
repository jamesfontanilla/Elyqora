import { describe, expect, it } from "vitest";
import { isNavigationPathActive } from "@/lib/navigation";

describe("sidebar navigation state", () => {
  it("highlights the current module and its nested routes", () => {
    expect(isNavigationPathActive("/docs", "/docs")).toBe(true);
    expect(isNavigationPathActive("/docs/abc/edit", "/docs")).toBe(true);
    expect(isNavigationPathActive("/docs", "/hub")).toBe(false);
    expect(isNavigationPathActive("/files", "/docs")).toBe(false);
  });

  it("keeps Settings active throughout settings routes", () => {
    expect(isNavigationPathActive("/settings/profile", "/settings/profile")).toBe(true);
    expect(isNavigationPathActive("/settings/members", "/settings/profile")).toBe(true);
    expect(isNavigationPathActive("/hub", "/settings/profile")).toBe(false);
  });
});
