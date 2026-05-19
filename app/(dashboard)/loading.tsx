export default function Loading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">ກຳລັງໂຫຼດ...</p>
      </div>
    </div>
  );
}
