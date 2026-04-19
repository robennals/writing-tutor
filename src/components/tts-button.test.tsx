import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TtsButton } from "./tts-button";

// jsdom doesn't implement speechSynthesis; stub just enough to drive the
// component. Capture utterances so we can invoke their onend/onerror hooks.
interface FakeUtterance {
  text: string;
  rate?: number;
  pitch?: number;
  onend?: () => void;
  onerror?: () => void;
}

const spoken: FakeUtterance[] = [];
const speakSpy = vi.fn((u: FakeUtterance) => spoken.push(u));
const cancelSpy = vi.fn();

beforeEach(() => {
  spoken.length = 0;
  speakSpy.mockClear();
  cancelSpy.mockClear();

  class FakeSpeechSynthesisUtterance {
    text: string;
    rate = 1;
    pitch = 1;
    onend: (() => void) | undefined;
    onerror: (() => void) | undefined;
    constructor(text: string) {
      this.text = text;
    }
  }
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    FakeSpeechSynthesisUtterance;

  (globalThis as unknown as { speechSynthesis: unknown }).speechSynthesis = {
    speak: speakSpy,
    cancel: cancelSpy,
  };
});

describe("TtsButton", () => {
  it("renders the given label initially and shows the Volume2 icon", () => {
    render(<TtsButton text="hello" label="Hear My Essay" />);
    expect(screen.getByRole("button")).toHaveTextContent("Hear My Essay");
  });

  it("falls back to a 'Listen' label when none is given", () => {
    render(<TtsButton text="hello" />);
    expect(screen.getByRole("button")).toHaveTextContent("Listen");
  });

  it("speaks the given text when clicked, setting rate and pitch", () => {
    render(<TtsButton text="hello world" />);
    fireEvent.click(screen.getByRole("button"));
    expect(speakSpy).toHaveBeenCalledTimes(1);
    expect(spoken[0].text).toBe("hello world");
    expect(spoken[0].rate).toBe(0.85);
    expect(spoken[0].pitch).toBe(1.0);
  });

  it("toggles to 'Stop' while speaking, then cancels on a second click", () => {
    render(<TtsButton text="hi" />);
    const btn = screen.getByRole("button");

    fireEvent.click(btn);
    expect(btn).toHaveTextContent("Stop");

    fireEvent.click(btn);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(btn).not.toHaveTextContent("Stop");
  });

  it("resets state on the utterance's onend event", () => {
    render(<TtsButton text="hi" />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(btn).toHaveTextContent("Stop");

    // Simulate the utterance finishing. Wrap in act() so React flushes the
    // setState that happens outside a normal event handler.
    act(() => {
      spoken[0].onend?.();
    });
    expect(screen.getByRole("button")).not.toHaveTextContent("Stop");
  });

  it("resets state on the utterance's onerror event", () => {
    render(<TtsButton text="hi" />);
    fireEvent.click(screen.getByRole("button"));
    act(() => {
      spoken[0].onerror?.();
    });
    expect(screen.getByRole("button")).not.toHaveTextContent("Stop");
  });
});
