// @ts-check
const { test, expect } = require("@playwright/test");

const credentials = {
  Admin: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
  Staff: { email: process.env.E2E_STAFF_EMAIL, password: process.env.E2E_STAFF_PASSWORD },
  Client: { email: process.env.E2E_CLIENT_EMAIL, password: process.env.E2E_CLIENT_PASSWORD },
};

function roleReady(role, testInfo) {
  test.skip(testInfo.project.name !== "portrait-375", "Role journeys run once.");
  test.skip(!credentials[role].email || !credentials[role].password, `${role} E2E credentials are not configured.`);
}

async function login(page, role) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email Address").fill(credentials[role].email);
  await page.getByLabel("Password", { exact: true }).fill(credentials[role].password);
  await page.getByRole("button", { name: /Sign In/ }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/);
  // Confirm the authenticated dashboard shell rendered. Role-specific coverage
  // is asserted by each test's role-scoped navigation checks below.
  await expect(page.locator(".sidebar-brand-text")).toContainText("Bolonsori");
}

test("Admin sees and opens administrative operations", async ({ page }, testInfo) => {
  roleReady("Admin", testInfo);
  await login(page, "Admin");
  await expect(page.getByRole("link", { name: "Broadcasts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Analytics" })).toBeVisible();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Verification" }).click();
  await expect(page.getByRole("heading", { name: "Record Verification" })).toBeVisible();
});

test("Staff receives verification tools without Admin controls", async ({ page }, testInfo) => {
  roleReady("Staff", testInfo);
  await login(page, "Staff");
  await expect(page.getByRole("link", { name: "Verification" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Broadcasts" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Verification" }).click();
  await expect(page.getByRole("heading", { name: "Record Verification" })).toBeVisible();
});
test("Client submits and privately tracks a request", async ({ page }, testInfo) => {
  roleReady("Client", testInfo);
  await login(page, "Client");
  await expect(page.getByRole("link", { name: "My Requests" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Graves" })).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "My Requests" }).click();

  const description = `Playwright inquiry ${Date.now()}`;
  await page.getByLabel("Request type").selectOption("inquiry");
  await page.getByLabel("Description").fill(description);
  await page.getByRole("button", { name: "Submit Request" }).click();
  const success = page.getByRole("status").filter({ hasText: "Reference ID:" });
  await expect(success).toContainText("Reference ID:");
  const referenceId = (await success.textContent()).match(/Reference ID:\s*(\S+)/)?.[1];
  expect(referenceId).toBeTruthy();

  await page.getByLabel("Reference ID").fill(referenceId);
  await page.getByRole("button", { name: "Track" }).click();
  await expect(page.getByText(referenceId, { exact: true })).toBeVisible();
});