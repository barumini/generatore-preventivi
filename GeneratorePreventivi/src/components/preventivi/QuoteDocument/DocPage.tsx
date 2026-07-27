import "./print.css";

export function DocPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="doc-desk">
      <div className="doc-sheet">{children}</div>
    </div>
  );
}
