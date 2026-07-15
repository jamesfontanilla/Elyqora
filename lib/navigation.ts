export function isNavigationPathActive(pathname: string, href: string) {
  if (href === "/settings/profile") return pathname === "/settings" || pathname.startsWith("/settings/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
