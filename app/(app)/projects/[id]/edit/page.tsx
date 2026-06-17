"use client";

/** v2 — Edit project. Loads the project, prefills the shared form. */
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProjectsBoq } from "@/_actions/projects";
import ProjectForm, { type ProjectInitial } from "../../_ProjectForm";
import { useT } from "@/_lib/i18n";

const toDateInput = (v: unknown): string => {
  if (!v) return "";
  const s = String(v);
  return s.slice(0, 10);
};

const parseCoord = (v: unknown): { lat: number; lng: number } | null => {
  const s = String(v ?? "").trim();
  if (!s.includes(",")) return null;
  const [a, b] = s.split(",").map((x) => parseFloat(x.trim()));
  return Number.isFinite(a) && Number.isFinite(b) ? { lat: a, lng: b } : null;
};

export default function EditProjectPage() {
  const { id } = useParams();
  const t = useT();
  const [initial, setInitial] = useState<ProjectInitial | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res: any = await getProjectsBoq({ projectId: String(id) });
        const p = res?.success ? (res.data || [])[0] : null;
        if (!alive) return;
        if (!p) {
          setNotFound(true);
          return;
        }
        setInitial({
          projectName: p.project_name ?? "",
          projectDescription: p.project_description ?? "",
          coordinator: p.coordinator ?? "",
          coordinatorPhone: p.phone ?? "",
          registrationDate: toDateInput(p.date_register),
          province: p.province ? String(p.province) : "",
          district: p.district ? String(p.district) : "",
          village: p.village ? String(p.village) : "",
          businessType: p.business_type_id ? String(p.business_type_id) : "",
          businessModel: p.business_model_id ? String(p.business_model_id) : "",
          projectType: p.project_type ? String(p.project_type) : "",
          saleStaffId: p.sale_code ? String(p.sale_code) : "",
          imageUrl: p.image_url ?? "",
          coord: parseCoord(p.project_lg),
          custCode: p.sml_code ? String(p.sml_code) : "",
          custName: p.sml_code ? String(p.sml_code) : "",
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }
  if (notFound || !initial) {
    return <div className="px-4 py-10 text-center text-[var(--theme-text-mute)]">{t("projects.notFound", "ບໍ່ພົບໂຄງການ")}</div>;
  }

  return <ProjectForm mode="edit" projectId={String(id)} initial={initial} />;
}
