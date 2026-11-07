import config from "./playwright.config";
export default { ...config, webServer: undefined, outputDir: "/tmp/graceline-agent-activity-e2e", use: { ...config.use, baseURL: "http://127.0.0.1:3000" } };
