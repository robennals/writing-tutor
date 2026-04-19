import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "./page";

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, back: vi.fn(), replace: vi.fn() }),
}));

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  pushSpy.mockClear();
});

function mockFetchOk(body: unknown) {
  fetchSpy = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  // @ts-expect-error — override for observation.
  globalThis.fetch = fetchSpy;
}

function mockFetchFail() {
  fetchSpy = vi.fn(async () =>
    new Response(JSON.stringify({ error: "bad" }), { status: 401 })
  );
  // @ts-expect-error — override for observation.
  globalThis.fetch = fetchSpy;
}

describe("LoginPage", () => {
  it("renders the form", () => {
    mockFetchOk({ ok: true, role: "child" });
    render(<LoginPage />);
    expect(screen.getByLabelText(/Username/)).toBeDefined();
    expect(screen.getByLabelText(/Password/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Log In/ })).toBeDefined();
  });

  it("POSTs credentials and routes children to /", async () => {
    mockFetchOk({ ok: true, role: "child" });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/Username/), {
      target: { value: "owen" },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: "owen123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Log In/ }));

    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith("/"));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/auth",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "owen", password: "owen123" }),
      })
    );
  });

  it("routes parents to /parent", async () => {
    mockFetchOk({ ok: true, role: "parent" });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/Username/), {
      target: { value: "parent" },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: "parent123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Log In/ }));
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith("/parent"));
  });

  it("shows an error message on failed login and re-enables the button", async () => {
    mockFetchFail();
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/Username/), {
      target: { value: "x" },
    });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: "y" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Log In/ }));
    await waitFor(() =>
      expect(screen.getByText(/Wrong username or password/)).toBeDefined()
    );
    expect(
      screen.getByRole("button", { name: /Log In/ })
    ).not.toBeDisabled();
  });
});
