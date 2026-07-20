import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that finishing sign-in redirects the user to the post-auth
 * destination on its own — no manual Back-press required.
 *
 * Requires TEST_EMAIL and TEST_PASSWORD env vars for an existing
 * confirmed account. The test is skipped when either is missing.
 */

const POST_AUTH_PATHS = ["/onboarding", "/studio"];

async function fillAuthForm(page: Page, email: string, password: string) {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
}

async function expectLandedPostAuth(page: Page) {
  await expect
    .poll(
      () => {
        const url = new URL(page.url());
        return POST_AUTH_PATHS.some((p) => url.pathname.startsWith(p));
      },
      { timeout: 15_000, message: "Expected auto-redirect to /onboarding or /studio after auth" },
    )
    .toBe(true);

  // The auth page's "Taking you there…" state must not linger — the
  // whole point is that redirect completes without a manual Back press.
  await expect(page.getByRole("heading", { name: /taking you there/i })).toHaveCount(0);
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
}

test("sign-in completes and redirects without needing Back", async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  test.skip(!email || !password, "Set TEST_EMAIL and TEST_PASSWORD to run this test.");

  await page.goto("/auth?mode=signup&next=%2Fonboarding");
  await expect(page.locator('input[type="email"]')).toBeVisible();

  const toggle = page.getByRole("button", { name: /already have an account/i });
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
  await fillAuthForm(page, email!, password!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expectLandedPostAuth(page);
});