import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const uniqueName = () => `user_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
let username;

// Helper: fill the form on the current page and submit it.
async function submitForm(page, username, password, button) {
  // Hash navigation renders asynchronously; wait for the destination form.
  await expect(page.getByRole("button", { name: button, exact: true })).toBeVisible();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: button }).click();
}

// PostgreSQL keeps accounts across runs. Each test registers a unique user.
test.beforeEach(async ({ page }) => {
  username = uniqueName();
  await page.goto("/#/register");
  await submitForm(page, username, "secret123", "Register");
  await expect(page.getByRole("alert")).toHaveText(`Account created for ${username}. Please log in.`);
});

// Happy path
test("registered user can log in", async ({ page }) => {
  await submitForm(page, username, "secret123", "Log in");

  await expect(page).toHaveURL(/#\/welcome$/);
  await expect(page.getByRole("heading", { name: `Welcome, ${username}!` })).toBeVisible();
});

// Sad path
test("login with invalid credentials shows an error", async ({ page }) => {
  await submitForm(page, username, "wrong-pass1", "Log in");

  await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeHidden();
});

test("unknown user cannot log in", async ({ page }) => {
  await submitForm(page, uniqueName(), "secret123", "Log in");
  await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
  await expect(page).toHaveURL(/#\/login$/);
});

test("duplicate registration preserves the original password", async ({ page }) => {
  await page.getByRole("link", { name: "Create an account" }).click();
  await submitForm(page, ` ${username.toUpperCase()} `, "different123", "Register");
  await expect(page.getByRole("alert")).toHaveText("Username already taken");
  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await submitForm(page, username, "secret123", "Log in");
  await expect(page.getByRole("heading", { name: `Welcome, ${username}!` })).toBeVisible();
});

for (const { username, password, message } of [
  { username: "bob", password: "abc", message: "Password must be at least 8 characters" },
  { username: "bob", password: "abcdefgh", message: "Password must contain at least one digit" },
  { username: "<script>", password: "secret123", message: "Username must be 3-20 characters: letters, digits or underscore" },
]) {
  test(`registration rejects invalid input: ${message}`, async ({ page }) => {
    await page.getByRole("link", { name: "Create an account" }).click();
    await submitForm(page, username, password, "Register");
    await expect(page.getByRole("alert")).toHaveText(message);
    await expect(page).toHaveURL(/#\/register$/);
    await expect(page.getByRole("button", { name: "Register", exact: true })).toBeEnabled();
    // A corrected submission must succeed after validation fails.
    const correctedName = uniqueName();
    await submitForm(page, correctedName, "secret123", "Register");
    await expect(page.getByRole("alert")).toHaveText(`Account created for ${correctedName}. Please log in.`);
  });
}

test("registration and login normalize username case and whitespace", async ({ page }) => {
  await page.getByRole("link", { name: "Create an account" }).click();
  const normalizedName = uniqueName();
  await submitForm(page, ` ${normalizedName.toUpperCase()} `, "secret123", "Register");
  await expect(page.getByRole("alert")).toHaveText(`Account created for ${normalizedName}. Please log in.`);
  await submitForm(page, ` ${normalizedName.toUpperCase()} `, "secret123", "Log in");
  await expect(page.getByRole("heading", { name: `Welcome, ${normalizedName}!` })).toBeVisible();
});

test("logout blocks direct access to the welcome page and permits login again", async ({ page }) => {
  await submitForm(page, username, "secret123", "Log in");
  await expect(page.getByRole("heading", { name: `Welcome, ${username}!` })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/#\/login$/);
  // Hash navigation preserves the database accounts, matching real navigation.
  await page.evaluate(() => { location.hash = "/welcome"; });
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("button", { name: "Log out" })).toBeHidden();
  await submitForm(page, username, "secret123", "Log in");
  await expect(page.getByRole("heading", { name: `Welcome, ${username}!` })).toBeVisible();
});

test("refresh clears the UI session but preserves database accounts", async ({ page }) => {
  await submitForm(page, username, "secret123", "Log in");
  await expect(page).toHaveURL(/#\/welcome$/);
  await page.reload();
  await expect(page).toHaveURL(/#\/login$/);
  await submitForm(page, username, "secret123", "Log in");
  await expect(page.getByRole("heading", { name: `Welcome, ${username}!` })).toBeVisible();
});
