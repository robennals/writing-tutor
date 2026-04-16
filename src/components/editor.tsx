"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect } from "react";

export function EssayEditor({
  content,
  onUpdate,
  editable = true,
}: {
  content: string;
  onUpdate: (html: string, text: string) => void;
  editable?: boolean;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-lg max-w-none focus:outline-none min-h-[200px] p-5 leading-[1.8]",
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML(), editor.getText());
    },
  });

  const setContent = useCallback(
    (newContent: string) => {
      if (editor && newContent !== editor.getHTML()) {
        editor.commands.setContent(newContent);
      }
    },
    [editor]
  );

  useEffect(() => {
    if (editor && !editable) {
      setContent(content);
    }
  }, [content, editor, editable, setContent]);

  if (!editor) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#1e1e1e]">
      <EditorContent editor={editor} />
    </div>
  );
}
