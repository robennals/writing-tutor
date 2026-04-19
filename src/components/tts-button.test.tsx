import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { TtsButton } from "./tts-button";

// ——— Test doubles for the browser streaming stack ——————————————————————
//
// The new TtsButton drives MediaSource + Audio + fetch + ReadableStream.
// jsdom implements none of those, so we stub thin versions that let us
// script the streaming sequence deterministically.

interface EventCapable {
  addEventListener(ev: string, cb: (e?: Event) => void): void;
  removeEventListener(ev: string, cb: (e?: Event) => void): void;
  dispatchEvent(ev: string): void;
}

function makeEventTarget<T extends object>(base: T): T & EventCapable {
  const listeners = new Map<string, Set<(e?: Event) => void>>();
  return Object.assign(base, {
    addEventListener(name: string, cb: (e?: Event) => void) {
      const set = listeners.get(name) ?? new Set();
      set.add(cb);
      listeners.set(name, set);
    },
    removeEventListener(name: string, cb: (e?: Event) => void) {
      listeners.get(name)?.delete(cb);
    },
    dispatchEvent(name: string) {
      listeners.get(name)?.forEach((cb) => cb(new Event(name)));
    },
  });
}

interface FakeAudio extends EventCapable {
  src: string;
  error: unknown;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
}

interface FakeSourceBuffer extends EventCapable {
  appendBuffer: ReturnType<typeof vi.fn>;
}

interface FakeMediaSource extends EventCapable {
  readyState: string;
  addSourceBuffer: ReturnType<typeof vi.fn>;
  endOfStream: ReturnType<typeof vi.fn>;
}

let currentAudio: FakeAudio | null = null;
let currentMediaSource: FakeMediaSource | null = null;
let currentSourceBuffer: FakeSourceBuffer | null = null;
let fetchController: {
  send: (body: BodyInit | null, status?: number) => void;
  pushChunk: (chunk: Uint8Array) => Promise<void>;
  close: () => void;
} | null = null;
let fetchSpy: ReturnType<typeof vi.fn>;

function installBrowserStubs() {
  // Audio — jsdom has one that throws on .play(); replace wholesale.
  class StubAudio {
    src = "";
    error: unknown = null;
    play = vi.fn(async () => {});
    pause = vi.fn();
    load = vi.fn();
    removeAttribute = vi.fn();
    constructor(src: string) {
      this.src = src;
      currentAudio = makeEventTarget(this) as unknown as FakeAudio;
      return currentAudio as unknown as StubAudio;
    }
  }
  (globalThis as unknown as { Audio: unknown }).Audio = StubAudio;

  // MediaSource
  class StubMediaSource {
    readyState = "closed";
    addSourceBuffer = vi.fn(() => {
      currentSourceBuffer = makeEventTarget({
        appendBuffer: vi.fn(() => {
          // Synchronously signal updateend on next microtask.
          queueMicrotask(() => currentSourceBuffer?.dispatchEvent("updateend"));
        }),
      }) as unknown as FakeSourceBuffer;
      return currentSourceBuffer;
    });
    endOfStream = vi.fn(() => {
      this.readyState = "ended";
    });
    constructor() {
      currentMediaSource = makeEventTarget(this) as unknown as FakeMediaSource;
      return currentMediaSource as unknown as StubMediaSource;
    }
  }
  (globalThis as unknown as { MediaSource: unknown }).MediaSource =
    StubMediaSource;

  // URL.createObjectURL / revokeObjectURL
  let n = 0;
  (
    globalThis as unknown as { URL: typeof URL }
  ).URL.createObjectURL = vi.fn(() => `blob:${++n}`);
  (globalThis as unknown as { URL: typeof URL }).URL.revokeObjectURL =
    vi.fn();

  // fetch — hand back a ReadableStream the test can script.
  fetchSpy = vi.fn(() => {
    let pushResolve: ((v: Uint8Array) => void) | null = null;
    let closed = false;
    const queue: Uint8Array[] = [];

    const stream = new ReadableStream<Uint8Array>({
      pull(ctrl) {
        return new Promise<void>((resolve) => {
          const flush = () => {
            if (queue.length > 0) {
              ctrl.enqueue(queue.shift()!);
              resolve();
            } else if (closed) {
              ctrl.close();
              resolve();
            } else {
              pushResolve = (v) => {
                ctrl.enqueue(v);
                pushResolve = null;
                resolve();
              };
            }
          };
          flush();
        });
      },
    });

    const response = new Response(stream, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });

    fetchController = {
      send() {},
      pushChunk: async (chunk: Uint8Array) => {
        if (pushResolve) pushResolve(chunk);
        else queue.push(chunk);
      },
      close: () => {
        closed = true;
        if (pushResolve) {
          const r = pushResolve;
          pushResolve = null;
          (r as unknown as (v: Uint8Array | undefined) => void)(undefined);
        }
      },
    };
    return Promise.resolve(response);
  });
  (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;
}

beforeEach(() => {
  currentAudio = null;
  currentMediaSource = null;
  currentSourceBuffer = null;
  fetchController = null;
  installBrowserStubs();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TtsButton — rendering", () => {
  it("renders the given label at idle", () => {
    render(<TtsButton text="hello" label="Hear My Essay" />);
    expect(screen.getByRole("button")).toHaveTextContent("Hear My Essay");
  });

  it("falls back to 'Listen' when no label is given", () => {
    render(<TtsButton text="hello" />);
    expect(screen.getByRole("button")).toHaveTextContent("Listen");
  });

  it("is disabled when idle and text is empty/whitespace", () => {
    render(<TtsButton text="   " />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("TtsButton — click behavior", () => {
  it("transitions to Loading, then Stop after the first audio chunk arrives", async () => {
    render(<TtsButton text="hello" />);
    const btn = screen.getByRole("button");

    await act(async () => {
      fireEvent.click(btn);
    });

    // After click: status=loading, icon is spinner, label is 'Loading'.
    await waitFor(() => expect(btn).toHaveTextContent("Loading"));

    // Fire sourceopen so the component's async flow starts fetching.
    await act(async () => {
      currentMediaSource!.dispatchEvent("sourceopen");
    });

    // Now fetch should have been invoked.
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/tts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ text: "hello" }),
        })
      )
    );

    // Stream in the first chunk → appendChunk resolves → firstChunk transition.
    await act(async () => {
      await fetchController!.pushChunk(new Uint8Array([1, 2, 3]));
    });

    await waitFor(() => expect(btn).toHaveTextContent("Stop"));
    expect(currentAudio!.play).toHaveBeenCalled();
  });

  it("aborts/cleans up on a second click while non-idle (Stop behavior)", async () => {
    render(<TtsButton text="hi" />);
    const btn = screen.getByRole("button");

    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() => expect(btn).toHaveTextContent("Loading"));

    // Second click during loading → cleanup, back to idle.
    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() => expect(btn).toHaveTextContent("Listen"));
    expect(currentAudio!.pause).toHaveBeenCalled();
  });

  it("cleans up and returns to idle when the audio element emits 'ended'", async () => {
    render(<TtsButton text="hi" />);
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    await act(async () => {
      currentMediaSource!.dispatchEvent("sourceopen");
    });
    await act(async () => {
      await fetchController!.pushChunk(new Uint8Array([1]));
    });
    await waitFor(() => expect(btn).toHaveTextContent("Stop"));

    await act(async () => {
      currentAudio!.dispatchEvent("ended");
    });
    await waitFor(() => expect(btn).toHaveTextContent("Listen"));
  });

  it("cleans up when the audio element emits 'error'", async () => {
    render(<TtsButton text="hi" />);
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    await act(async () => {
      currentMediaSource!.dispatchEvent("sourceopen");
    });
    await act(async () => {
      await fetchController!.pushChunk(new Uint8Array([1]));
    });
    await waitFor(() => expect(btn).toHaveTextContent("Stop"));

    // Silence the console.error the component emits on purpose.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      currentAudio!.dispatchEvent("error");
    });
    await waitFor(() => expect(btn).toHaveTextContent("Listen"));
    spy.mockRestore();
  });

  it("does nothing when clicked with no text", async () => {
    const { rerender } = render(<TtsButton text="" />);
    const btn = screen.getByRole("button");
    // Button is disabled while idle + empty, but force a click to cover the
    // early-return branch in play().
    rerender(<TtsButton text=" " />);
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls endOfStream when the response body finishes reading", async () => {
    render(<TtsButton text="hi" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    await act(async () => {
      currentMediaSource!.dispatchEvent("sourceopen");
    });
    await act(async () => {
      await fetchController!.pushChunk(new Uint8Array([1]));
    });
    await act(async () => {
      currentMediaSource!.readyState = "open";
      fetchController!.close();
    });
    await waitFor(() => expect(currentMediaSource!.endOfStream).toHaveBeenCalled());
  });

  it("handles fetch !ok by going back to idle", async () => {
    // Swap the fetch stub to return 500.
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "nope" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TtsButton text="hi" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    await act(async () => {
      currentMediaSource!.dispatchEvent("sourceopen");
    });
    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveTextContent("Listen")
    );
    spy.mockRestore();
  });

  it("cleans up when audio.play() rejects (autoplay blocked)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TtsButton text="hi" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    // Before the first chunk, override play to reject.
    await act(async () => {
      currentMediaSource!.dispatchEvent("sourceopen");
    });
    currentAudio!.play = vi.fn(() =>
      Promise.reject(new Error("autoplay blocked"))
    );
    await act(async () => {
      await fetchController!.pushChunk(new Uint8Array([1]));
    });
    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveTextContent("Listen")
    );
    spy.mockRestore();
  });

  it("handles an OK response whose body is null (no stream available)", async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () =>
      new Response(null, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      })
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TtsButton text="hi" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    await act(async () => {
      currentMediaSource!.dispatchEvent("sourceopen");
    });
    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveTextContent("Listen")
    );
    spy.mockRestore();
  });

  it("cleans up when the streaming body throws a non-Abort error", async () => {
    // Swap fetch to return a stream that errors on read.
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        pull() {
          throw new Error("stream broken");
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      });
    });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TtsButton text="hi" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    await act(async () => {
      currentMediaSource!.dispatchEvent("sourceopen");
    });
    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveTextContent("Listen")
    );
    spy.mockRestore();
  });

  it("handles addSourceBuffer throwing (e.g. unsupported codec) by going back to idle", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TtsButton text="hi" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    // After the MediaSource is constructed but before sourceopen, swap in a
    // throwing addSourceBuffer implementation.
    currentMediaSource!.addSourceBuffer = vi.fn(() => {
      throw new Error("unsupported codec");
    });
    await act(async () => {
      currentMediaSource!.dispatchEvent("sourceopen");
    });
    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveTextContent("Listen")
    );
    spy.mockRestore();
  });
});
