type DashboardStatCardProps = {
  label: string;
  value: string;
};

export default function DashboardStatCard({
  label,
  value,
}: DashboardStatCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-sm text-neutral-500">
        {label}
      </p>

      <p className="mt-3 text-2xl font-medium tracking-tight text-neutral-950">
        {value}
      </p>
    </div>
  );
}