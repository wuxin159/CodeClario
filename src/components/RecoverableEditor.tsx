import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import type CodeEditor from "./CodeEditor";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof CodeEditor>;
// 懒加载失败只降级编辑区，保留导航、教学与受控草稿，避免整个学习页面白屏。
class EditorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode }, { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function RecoverableEditor(props: Props) {
  const [attempt, setAttempt] = useState(0);
  // 重试时重建 lazy 实例和错误边界，失败过的组件状态不能直接重复使用。
  const Editor = useMemo(() => lazy(() => import("./CodeEditor")), [attempt]);
  const label = `${props.language === "c" ? "C 语言" : props.language === "cpp" ? "C++" : "Python"}代码编辑器`;
  return (
    <EditorBoundary key={attempt} fallback={
      <div className="editor-recovery">
        <p role="alert">编辑器未能加载。可以在下方继续编辑和运行，当前内容不会因编辑器加载失败而丢失。</p>
        <button type="button" className="button secondary" onClick={() => setAttempt((n) => n + 1)}>重试加载编辑器</button>
        <textarea aria-label={label} value={props.value} spellCheck={false} onChange={(event) => props.onChange(event.target.value)} />
      </div>
    }>
      <Suspense fallback={<div className="editor-loading">正在加载编辑器…</div>}>
        <Editor {...props} />
      </Suspense>
    </EditorBoundary>
  );
}
