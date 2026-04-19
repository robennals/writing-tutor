import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { EssayEditor } from "./editor";

// Tiptap uses ProseMirror which works in jsdom, but we don't need its full
// machinery to test this wrapper — we care about the three things this file
// owns: it renders only once the editor hook has initialized, it calls the
// onUpdate callback with html+text when the editor emits updates, and it
// syncs external `content` changes when the editor is non-editable.

let capturedOptions: {
  onUpdate?: (args: { editor: FakeEditor }) => void;
  editable?: boolean;
  content?: string;
} = {};

class FakeEditor {
  private _html: string;
  commands = {
    setContent: (html: string) => {
      this._html = html;
    },
  };
  constructor(html: string) {
    this._html = html;
  }
  getHTML() {
    return this._html;
  }
  getText() {
    return this._html.replace(/<[^>]+>/g, "");
  }
  triggerUpdate() {
    capturedOptions.onUpdate?.({ editor: this });
  }
}

let editorInstance: FakeEditor | null = null;
vi.mock("@tiptap/react", async () => {
  const React = await import("react");
  return {
    useEditor: (options: {
      onUpdate?: (args: { editor: FakeEditor }) => void;
      editable?: boolean;
      content?: string;
    }) => {
      // Mirror real useEditor's useRef semantics: the editor is created once
      // per hook lifetime, not per render. Options are re-captured each render.
      const ref = React.useRef<FakeEditor | null>(null);
      capturedOptions = options;
      if (!ref.current) {
        ref.current = new FakeEditor(options.content ?? "");
      }
      editorInstance = ref.current;
      return ref.current;
    },
    EditorContent: ({ editor }: { editor: { getHTML: () => string } }) => (
      <div data-testid="editor-content">{editor.getHTML()}</div>
    ),
  };
});
vi.mock("@tiptap/starter-kit", () => ({ default: {} }));

describe("EssayEditor", () => {
  it("renders EditorContent with the initial content", () => {
    const { getByTestId } = render(
      <EssayEditor content="<p>hello</p>" onUpdate={vi.fn()} />
    );
    expect(getByTestId("editor-content").textContent).toBe("<p>hello</p>");
  });

  it("fires onUpdate with both html and plain text when the editor emits updates", () => {
    const onUpdate = vi.fn();
    render(<EssayEditor content="<p>hi</p>" onUpdate={onUpdate} />);
    editorInstance?.triggerUpdate();
    expect(onUpdate).toHaveBeenCalledWith("<p>hi</p>", "hi");
  });

  it("when editable=false and content prop changes, syncs the editor via setContent", async () => {
    const { rerender } = render(
      <EssayEditor content="<p>old</p>" onUpdate={vi.fn()} editable={false} />
    );
    rerender(
      <EssayEditor content="<p>new</p>" onUpdate={vi.fn()} editable={false} />
    );
    await waitFor(() =>
      expect(editorInstance?.getHTML()).toBe("<p>new</p>")
    );
  });

  it("when editable=true, does NOT overwrite editor content on prop change (user owns it)", () => {
    const { rerender } = render(
      <EssayEditor content="<p>old</p>" onUpdate={vi.fn()} editable={true} />
    );
    // Simulate user editing to a different value.
    editorInstance?.commands.setContent("<p>user-typed</p>");
    rerender(
      <EssayEditor content="<p>external</p>" onUpdate={vi.fn()} editable={true} />
    );
    expect(editorInstance?.getHTML()).toBe("<p>user-typed</p>");
  });
});
