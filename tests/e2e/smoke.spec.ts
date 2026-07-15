import { test, expect } from "@playwright/test";

test("health route is public and sign-in is discoverable", async ({ page }) => {
  const health = await page.request.get("/health");
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).status).toBe("ok");

  await page.goto("/auth/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in to Elyqora" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
});
