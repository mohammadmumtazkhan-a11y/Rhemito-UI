/**
 * Smoke test — the full application mounts and shows the Rhemito shell.
 * Replaces the obsolete scaffold App.test.jsx that asserted on the old
 * "Mito Admin" UI.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "@/App";

beforeAll(() => {
  // jsdom does not implement matchMedia; the responsive layout hooks depend on it.
  if (!window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  // Keep server-state queries pending so the shell renders without a backend.
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

describe("App", () => {
  it("renders the Rhemito application shell", () => {
    render(<App />);
    expect(screen.getAllByText(/rhemito/i).length).toBeGreaterThan(0);
  });
});
