import Image from "next/image";
import { logout } from "@/lib/auth/actions";
import { NavLink } from "./NavLink";

export function Sidebar({ userName }: { userName: string }) {
  return (
    <aside
      className="no-print"
      style={{
        width: 220,
        flex: "none",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        borderRight: "1px solid var(--border-default)",
        padding: "18px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 4px" }}>
        <Image src="/assets/logo-dih-vicenza.svg" alt="DIH Vicenza" width={35} height={32} style={{ height: 32, width: "auto" }} />
        <div style={{ font: "700 13px var(--font-sans)", color: "var(--teal-800)", lineHeight: 1.15 }}>
          Generatore preventivi
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        <NavLink href="/preventivi">Preventivi</NavLink>
        <NavLink href="/clienti">Clienti</NavLink>
        <NavLink href="/catalogo">Catalogo servizi</NavLink>
        <NavLink href="/dashboard">Dashboard</NavLink>
      </nav>

      <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 12, marginTop: 12 }}>
        <div style={{ font: "500 12px var(--font-sans)", color: "var(--text-secondary)", marginBottom: 8, padding: "0 4px" }}>
          {userName}
        </div>
        <form action={logout}>
          <button
            type="submit"
            style={{
              width: "100%",
              height: 32,
              border: "1px solid var(--border-default)",
              background: "#fff",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              font: "500 12px var(--font-sans)",
              color: "var(--text-muted)",
            }}
          >
            Esci
          </button>
        </form>
      </div>
    </aside>
  );
}
