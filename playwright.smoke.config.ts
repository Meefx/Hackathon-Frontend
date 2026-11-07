import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./tests/smoke",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
});
