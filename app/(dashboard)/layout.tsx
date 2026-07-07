import { DashboardNav } from "./nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#06080f] text-slate-100">
      <div className="mx-auto w-full max-w-[1600px] px-6 pt-4">
        <DashboardNav />
      </div>
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
