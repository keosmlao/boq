"use client";


import AuthGuard from "@/_components/AuthGuard";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  CheckCircle,
  FileText,
  LayoutGrid,
  RefreshCw,
  Users,
} from "lucide-react";

const cards = [
  {
    title: "ຕາຕະລາງວຽກ",
    desc: "ກຳນົດ Work Schedule ຂອງໂຄງການ",
    to: "/service-admin/list-project",
    icon: CalendarClock,
  },
  {
    title: "BOQ",
    desc: "ລາຍການ BOQ ແລະ ສະຕັອກ",
    to: "/service-admin/list-boq",
    icon: FileText,
  },
  {
    title: "ໃບຂໍເບີກ",
    desc: "ຄຳຂໍອາໄຫຼ່ປະຈຳວຽກ",
    to: "/service-admin/list-request",
    icon: Briefcase,
  },
  {
    title: "ຂໍຄືນອາໄຫຼ່",
    desc: "ບັນທຶກການຄືນອາໄຫຼ່",
    to: "/service-admin/material-return-list",
    icon: RefreshCw,
  },
  {
    title: "ລາຍການອາໄຫຼ່",
    desc: "ສຳຫຼວດສະຕັອກທັງໝົດ",
    to: "/service-admin/list-sparepart",
    icon: LayoutGrid,
  },
  {
    title: "ບິນງານຊ່າງ",
    desc: "ຈັດການໃບງານ ແລະ ພິມໃບງານ",
    to: "/service-admin/work-orders",
    icon: CheckCircle,
  },
  {
    title: "ຈັດການຊ່າງ",
    desc: "ກຳນົດທີມ ແລະ ຜູ້ຊ່ວຍ",
    to: "/service-admin/technicians",
    icon: Users,
  },
];

function HeadTechnicianHome() {
  return (
    <div className="space-y-6 px-1 py-2">
      <section className="theme-hero-panel rounded-lg px-6 py-6 md:px-8">
        <div className="max-w-3xl">
          <div className="theme-chip-ghost inline-flex rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em]">
            Head Technician
          </div>
          <h1 className="mt-4 text-2xl font-semibold md:text-3xl">ໜ້າຫຼັກ ຫົວໜ້າຊ່າງ</h1>
          <p className="mt-2 text-sm leading-6 text-white/78 md:text-base">
            ເຂົ້າເຖິງ BOQ, ໃບຂໍເບີກ, ການຄືນອາໄຫຼ່ ແລະ ຈັດການທີມຊ່າງຈາກຫນ້າຫຼັກດຽວ.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.to}
              href={card.to}
              className="theme-card theme-card-hover group rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="theme-icon-badge flex h-12 w-12 items-center justify-center rounded-lg">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="mt-1 h-4 w-4 text-[var(--theme-text-soft)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--theme-primary)]" />
              </div>
              <h3 className="mt-4 text-lg font-semibold theme-heading">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 theme-copy">{card.desc}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["head_technician"]}>
      <HeadTechnicianHome />
    </AuthGuard>
  );
}
