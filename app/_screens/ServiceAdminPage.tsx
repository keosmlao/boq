"use client";

import Link from "next/link";
import { ArrowRight, Briefcase, CalendarClock, FileText } from "lucide-react";

const cards = [
  {
    href: "/service-admin/listproject",
    title: "ຕາຕະລາງວຽກ",
    desc: "ກຳນົດ Work Schedule ສຳລັບໂຄງການ",
    icon: CalendarClock,
  },
  {
    href: "/service-admin/listboq",
    title: "BOQ",
    desc: "ຈັດການລາຍການ ແລະ ແຜນວັດສະດຸ",
    icon: FileText,
  },
  {
    href: "/service-admin/listrequest",
    title: "ໃບຂໍເບີກ",
    desc: "ຕິດຕາມຄຳຂໍອຸປະກອນຂອງຫນ້າງານ",
    icon: Briefcase,
  },
];

export default function ServiceAdminPage() {
  return (
    <div className="space-y-6 px-1 py-2">
      <section className="theme-hero-panel rounded-lg px-6 py-6 md:px-8">
        <div className="max-w-3xl">
          <div className="theme-chip-ghost inline-flex rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em]">
            Service Admin
          </div>
          <h1 className="mt-4 text-2xl font-semibold md:text-3xl">ໜ້າຫຼັກງານບໍລິການ</h1>
          <p className="mt-2 text-sm leading-6 text-white/78 md:text-base">
            ເຂົ້າເຖິງຕາຕະລາງງານ, BOQ ແລະ ໃບຂໍເບີກ ພາຍໃນ workspace ດຽວ.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.href}
              href={card.href}
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

      <section className="theme-card rounded-lg p-5">
        <h2 className="theme-section-title">ວິທີໃຊ້ງານແບບໄວ</h2>
        <p className="mt-2 text-sm theme-copy">
          ເລີ່ມຈາກການເຂົ້າເບິ່ງ project schedule, ຈາກນັ້ນຈຶ່ງໄປຈັດການ BOQ ແລະ ຄຳຂໍວັດສະດຸຕາມລຳດັບ.
        </p>
      </section>
    </div>
  );
}
