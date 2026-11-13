import config from "./playwright.config.js";

// Container-only runs must fail if Compose is unavailable, never start Vite.
export default { ...config, webServer: undefined };
