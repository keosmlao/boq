/**
 * Shared document letterhead for printed bills — company logo + name on the
 * left, document title + meta rows on the right. Server component (no client
 * JS). Colors are explicit (not theme tokens) so the sheet always prints on
 * white regardless of the app's light/dark theme.
 */
export default function BillHead({
  title,
  meta,
}: {
  title: string;
  meta: { label: string; value: string }[];
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ODG.png" alt="ODIEN GROUP" className="h-14 w-auto object-contain" />
        <div>
          <div className="text-lg font-black leading-tight tracking-tight text-neutral-900">ODIEN GROUP</div>
          <div className="text-[11px] font-semibold text-neutral-500">ODG Project Management</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xl font-black tracking-tight text-neutral-900">{title}</div>
        <div className="mt-1.5 space-y-0.5">
          {meta.map((m, i) => (
            <div key={i} className="flex justify-end gap-2 text-[11.5px]">
              <span className="text-neutral-500">{m.label}:</span>
              <span className="font-bold text-neutral-900">{m.value || "-"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
