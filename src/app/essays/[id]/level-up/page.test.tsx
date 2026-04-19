import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LevelUpPage from "./page";

const pushSpy = vi.fn();
const searchParamsRef = { current: new URLSearchParams() };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => searchParamsRef.current,
}));

beforeEach(() => {
  pushSpy.mockClear();
});

describe("LevelUpPage", () => {
  it("renders the new level and writing type from the URL", () => {
    searchParamsRef.current = new URLSearchParams(
      "newLevel=3&type=creative"
    );
    render(<LevelUpPage />);
    expect(screen.getByText(/LEVEL UP/)).toBeDefined();
    expect(screen.getByText(/Creative Writing/)).toBeDefined();
    expect(screen.getByText(/Level 3: Idea Holder/)).toBeDefined();
  });

  it("defaults to level 2 and opinion when the params are missing", () => {
    searchParamsRef.current = new URLSearchParams();
    render(<LevelUpPage />);
    expect(screen.getByText(/Level 2: Sentence Expander/)).toBeDefined();
    expect(screen.getByText(/Opinion Writing/)).toBeDefined();
  });

  it("shows a 'Next up' preview only for levels below 10", () => {
    searchParamsRef.current = new URLSearchParams(
      "newLevel=9&type=opinion"
    );
    const { rerender } = render(<LevelUpPage />);
    expect(screen.getByText(/Next up:/)).toBeDefined();

    searchParamsRef.current = new URLSearchParams(
      "newLevel=10&type=opinion"
    );
    rerender(<LevelUpPage />);
    expect(screen.queryByText(/Next up:/)).toBeNull();
  });

  it("routes home when 'Keep Writing!' is clicked", () => {
    searchParamsRef.current = new URLSearchParams(
      "newLevel=2&type=opinion"
    );
    render(<LevelUpPage />);
    fireEvent.click(screen.getByRole("button", { name: /Keep Writing/ }));
    expect(pushSpy).toHaveBeenCalledWith("/");
  });
});
