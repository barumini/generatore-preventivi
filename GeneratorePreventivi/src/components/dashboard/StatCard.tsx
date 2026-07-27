export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        flex: 1,
        minWidth: 160,
      }}
    >
      <div style={{ font: "600 12px var(--font-sans)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ font: "700 26px var(--font-sans)", color: "var(--teal-800)" }}>{value}</div>
      {hint && <div style={{ font: "400 12px var(--font-sans)", color: "var(--text-muted)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
