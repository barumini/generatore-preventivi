import ResetPasswordForm from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--gray-100)",
        }}
      >
        <div
          style={{
            width: 360,
            background: "#fff",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: 28,
          }}
        >
          <div
            style={{
              font: "700 16px var(--font-sans)",
              color: "var(--teal-800)",
              marginBottom: 12,
            }}
          >
            Link non valido
          </div>
          <div style={{ font: "400 13px var(--font-sans)", color: "var(--text-secondary)" }}>
            Questo link di reset non è valido o è scaduto. Richiedine uno nuovo dalla pagina di accesso.
          </div>
        </div>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
