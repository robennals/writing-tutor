import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom doesn't implement scrollIntoView; stub it globally so components that
// auto-scroll inside useEffect don't throw during tests.
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.scrollIntoView = function () {};
}

// Testing-Library's auto-cleanup only runs when it detects a test global;
// explicitly clean up after every test so rendered DOM doesn't leak across
// them (some tests import `render` dynamically which bypasses auto-detection).
afterEach(() => {
  cleanup();
});
