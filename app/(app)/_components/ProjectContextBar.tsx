"use client";

/**
 * The project you are inside, kept on screen.
 *
 * The system's subject is the PROJECT; quotations, BOQs, work orders and
 * requests are things that happen to one. Once you open a project — or any
 * document belonging to it — this bar stays under the top bar carrying the
 * project's name, its stage, and one click back to its workspace. Without it,
 * opening a document from a project drops you into a page that could belong to
 * anything.
 *
 * The project id is read from the URL (/projects/<id>/…). Document pages that
 * are opened from a project carry it as ?project=<id>, so they show it too.
 */
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, FolderKanban, Loader2, Search } from "lucide-react";
import { getProjectBasic, getProjectsPage } from "@/_actions/projects";
import { useT } from "@/_lib/i18n";

type Basic = { id: string; project_name?: string | null; project_status?: string | null; sml_code?: string | null };

/** Cache per id for the session: the bar must never cost a visible wait. */
const cache = new Map<string, Basic>();

function projectIdFrom(pathname: string, search: URLSearchParams): string {
  const m = pathname.match(/^\/projects\/([^/]+)/);
  if (m && m[1] !== "new" && m[1] !== "map") return decodeURIComponent(m[1]);
  return search.get("project") || "";
}

export default function ProjectContextBar() {
  const t = useT();
  const pathname = usePathname() || "";
  const search = useSearchParams();
  const id = projectIdFrom(pathname, search);
  const [project, setProject] = useState<Basic | null>(id ? cache.get(id) ?? null : null);

  useEffect(() => {
    if (!id) {
      setProject(null);
      return;
    }
    const hit = cache.get(id);
    if (hit) {
      setProject(hit);
      return;
    }
    let alive = true;
    getProjectBasic(id)
      .then((res: any) => {
        if (!alive || !res?.success) return;
        const basic: Basic = { id, ...res.data };
        cache.set(id, basic);
        setProject(basic);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  if (!id || !project) return null;

  // On the project workspace itself the name is already the page title — the bar
  // then only earns its space on the document pages underneath it.
  const onWorkspace = /^\/projects\/[^/]+$/.test(pathname);
  if (onWorkspace) return null;

  return (
    <div className="relative flex flex-shrink-0 items-center gap-2.5 border-b border-[var(--border)] bg-[var(--brand-tint)] px-4 py-2 md:px-6">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-strong)]">
        <FolderKanban size={13} />
      </span>
      <Link
        href={`/projects/${encodeURIComponent(id)}`}
        className="min-w-0 truncate text-[12.5px] font-bold text-[var(--brand-strong)] hover:underline"
      >
        {project.project_name || project.sml_code || `#${id}`}
      </Link>

      {/* Switch project without going back to the list first. */}
      <ProjectSwitcher currentId={id} />

      {project.project_status && (
        <span className="hidden flex-shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--text-soft)] sm:inline">
          {project.project_status}
        </span>
      )}
      <ChevronRight size={13} className="flex-shrink-0 text-[var(--text-mute)]" />
      <span className="truncate text-[11.5px] font-semibold text-[var(--text-mute)]">
        {t("shell.inProjectContext", "ເອກະສານຂອງໂຄງການນີ້")}
      </span>
      <Link
        href={`/projects/${encodeURIComponent(id)}`}
        className="ml-auto flex-shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-soft)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
      >
        {t("shell.backToProject", "ກັບໄປໜ້າໂຄງການ")}
      </Link>
    </div>
  );
}

/**
 * Jump straight to another project. Searching hits the server (one page of
 * matches), so this stays instant whether there are 70 projects or 7,000.
 */
function ProjectSwitcher({ currentId }: { currentId: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await getProjectsPage({ q, page: 1, perPage: 8, sort: "project_name", dir: "asc" });
        if (res.success) setRows(res.data.rows);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, q]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={t("shell.switchProject", "ສະຫຼັບໂຄງການ")}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-mute)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--brand-strong)]"
      >
        <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute left-4 top-[calc(100%+4px)] z-50 w-[min(380px,90vw)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] md:left-6">
            <label className="flex h-10 items-center gap-2 border-b border-[var(--border-soft)] px-3">
              <Search size={14} className="text-[var(--text-mute)]" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("shell.searchProject", "ຄົ້ນຫາໂຄງການ...")}
                className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
              />
              {loading && <Loader2 size={13} className="animate-spin text-[var(--text-mute)]" />}
            </label>
            <div className="max-h-[300px] overflow-y-auto p-1.5">
              {rows.length === 0 ? (
                <p className="py-6 text-center text-[11.5px] text-[var(--text-mute)]">
                  {loading ? t("common.loading", "ກຳລັງໂຫຼດ...") : t("shell.noProjectFound", "ບໍ່ພົບໂຄງການ")}
                </p>
              ) : (
                rows.map((p) => {
                  const active = String(p.id) === currentId;
                  return (
                    <button
                      key={String(p.id)}
                      onClick={() => {
                        setOpen(false);
                        router.push(`/projects/${encodeURIComponent(String(p.id))}`);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        active ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "hover:bg-[var(--surface-sunken)]"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold text-[var(--text)]">
                          {p.project_name || p.sml_code || `#${p.id}`}
                        </span>
                        <span className="block truncate text-[10.5px] text-[var(--text-mute)]">
                          {[p.customer_name, p.project_status].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
