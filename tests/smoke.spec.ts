import { expect, test } from "@playwright/test";

test("landing, dashboard, and mobile navigation smoke test", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /Turn your invention/ })).toBeVisible();
  const menuButton = page.locator('summary[aria-label="Toggle navigation"]');
  await menuButton.click();
  await expect(page.locator("details.mobile-menu")).toHaveAttribute("open", "");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Workspace" })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Good morning/ })).toBeVisible();
  await expect(page.getByText("Portable water purifier", { exact: true })).toBeVisible();
});
