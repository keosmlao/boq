"use client";

/**
 * v2 (rebuild) login — the entry point of the new system.
 * Flat access model: on success, any user is fully authenticated (no roles).
 * Reuses the existing read-only `login` server action.
 */
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Loader2, Eye, EyeOff } from "lucide-react";
import { login } from "@/_actions/auth";
import { setV2User } from "../../_lib/session";

export default function V2LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ");
      return;
    }
    setLoading(true);
    try {
      const res: any = await login({ username, password });
      if (res?.success) {
        setV2User({
          username: res.username,
          name: (res.name_1 as string) || res.username,
          role: res.role,
          permissions: res.permissions || {},
        });
        router.replace("/");
      } else {
        setError(res?.message || "ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ");
      }
    } catch {
      setError("ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-primary-strong)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <LogIn size={26} />
          </div>
          <h1 className="text-xl font-bold">ລະບົບຂາຍ ແລະ ຕິດຕັ້ງໂຄງການ</h1>
          <p className="mt-1 text-sm text-white/80">ເຂົ້າສູ່ລະບົບ (ສະບັບໃໝ່)</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl bg-white p-6 shadow-[var(--theme-shadow-lg)]"
        >
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
              {error}
            </div>
          )}

          <label className="mb-1 block text-[12.5px] font-medium text-[var(--theme-text-soft)]">
            ຊື່ຜູ້ໃຊ້
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            className="mb-4 w-full rounded-lg border border-[var(--theme-border-subtle)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary-tint)]"
            placeholder="username"
          />

          <label className="mb-1 block text-[12.5px] font-medium text-[var(--theme-text-soft)]">
            ລະຫັດຜ່ານ
          </label>
          <div className="relative mb-5">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border-subtle)] px-3 py-2.5 pr-10 text-[14px] outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary-tint)]"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-text-mute)] hover:text-[var(--theme-text)]"
              tabIndex={-1}
            >
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--theme-primary)] py-2.5 text-[14px] font-semibold text-white transition hover:bg-[var(--theme-primary-strong)] disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {loading ? "ກຳລັງເຂົ້າ..." : "ເຂົ້າສູ່ລະບົບ"}
          </button>

          <p className="mt-4 text-center text-[11px] text-[var(--theme-text-mute)]">
            ສິດເຂົ້າເຖິງຂຶ້ນກັບການກຳນົດໂດຍຜູ້ຈັດການ
          </p>
        </form>
      </div>
    </div>
  );
}
