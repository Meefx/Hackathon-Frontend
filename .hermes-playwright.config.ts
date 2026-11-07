import base from "./playwright.config";
export default { ...base, outputDir: "/tmp/hermes-sandbox-playwright", use: { ...base.use, baseURL: "http://127.0.0.1:3000" }, webServer: undefined };
