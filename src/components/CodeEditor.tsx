import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { useEffect, useRef } from "react";
import { type Language } from "../../shared/curriculum";

const markAI = StateEffect.define<number>();
const aiHighlight = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(markAI)) {
        if (effect.value < 1 || effect.value > transaction.state.doc.lines)
          return Decoration.none;
        return Decoration.set([
          Decoration.line({ class: "cm-ai-focus" }).range(
            transaction.state.doc.line(effect.value).from,
          ),
        ]);
      }
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export default function CodeEditor({
  value,
  onChange,
  language,
  highlightLine,
}: {
  value: string;
  onChange: (code: string) => void;
  language: Language;
  highlightLine?: number;
}) {
  const editor = useRef<EditorView | null>(null);
  useEffect(() => {
    editor.current?.dispatch({ effects: markAI.of(highlightLine ?? 0) });
  }, [highlightLine]);
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme="dark"
      height="100%"
      onCreateEditor={(view) => {
        editor.current = view;
        view.dispatch({ effects: markAI.of(highlightLine ?? 0) });
      }}
      extensions={[
        language === "python" ? python() : cpp(),
        EditorView.lineWrapping,
        aiHighlight,
      ]}
      basicSetup={{
        foldGutter: false,
        highlightActiveLine: true,
        autocompletion: true,
      }}
      aria-label={`${language === "c" ? "C 语言" : language === "cpp" ? "C++" : "Python"}代码编辑器`}
    />
  );
}
