import { requireUserOrRedirect } from "@/lib/auth/session";
import { Sidebar } from "@/components/cms/Sidebar";

export default async function CmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUserOrRedirect();

  return (
    <div className="cms-shell">
      <Sidebar userName={user.name} />
      <main className="cms-main">{children}</main>
    </div>
  );
}
