import Link from "next/link";
import { Compass, Home } from "lucide-react";

/**
 * Global 404 — rendered for any unmatched route, outside the app shell.
 * Matches the Blue Pastel design language with a soft brand backdrop.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-md text-center animate-fade-in">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
          <Compass size={30} />
        </div>
        <h1 className="text-6xl font-black tracking-tight text-slate-900">404</h1>
        <span className="accent-rule mx-auto mt-4" />
        <p className="mt-5 text-sm font-semibold text-slate-600">
          ບໍ່ພົບໜ້າທີ່ທ່ານຊອກຫາ
        </p>
        <p className="mt-1.5 text-xs text-slate-400">
          ໜ້ານີ້ອາດຖືກຍ້າຍ ຫຼື ບໍ່ມີຢູ່ແລ້ວ
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-sm shadow-blue-600/25 transition-all duration-150 hover:bg-blue-700 active:scale-[0.98]"
        >
          <Home size={15} />
          ກັບໄປໜ້າຫຼັກ
        </Link>
      </div>
    </div>
  );
}
