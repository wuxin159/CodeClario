export default function TeachingText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(```[\s\S]*?```)/g).map((block, i) =>
        block.startsWith("```") ? (
          <pre className="teaching-code" key={i}>
            <code>
              {block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")}
            </code>
          </pre>
        ) : (
          <span key={i}>
            {block
              .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
              .map((part, j) =>
                part.startsWith("**") ? (
                  <strong key={j}>{part.slice(2, -2)}</strong>
                ) : part.startsWith("`") ? (
                  <code key={j}>{part.slice(1, -1)}</code>
                ) : (
                  part
                ),
              )}
          </span>
        ),
      )}
    </>
  );
}
