import { expect, test } from "@playwright/test";

test("Workshop landing, auth redirect, and mobile navigation smoke test", async ({ page, context }) => {
  await context.addCookies([{ name: "inventra_theme", value: "dark", domain: "127.0.0.1", path: "/" }]);
  await page.addInitScript(() => window.localStorage.setItem("inventra_theme", "dark"));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await expect(page.getByLabel(/appearance|theme/i)).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(254, 252, 249)");
  await expect(page.getByRole("heading", { name: /Turn your invention/ })).toBeVisible();
  await expect(page.locator(".workshop-phase")).toHaveCount(4);
  const menuButton = page.locator('summary[aria-label="Toggle navigation"]');
  await menuButton.click();
  await expect(page.locator("details.mobile-menu")).toHaveAttribute("open", "");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Workspace" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  for (const width of [375, 768, 1024, 1366, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
