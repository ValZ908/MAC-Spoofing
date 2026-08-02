export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--line-strong))] border-t-[hsl(var(--signal))]"
        aria-label="Loading"
      />
    </div>
  );
}
