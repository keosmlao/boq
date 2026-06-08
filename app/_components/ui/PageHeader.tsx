"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "./cn";

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  icon,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-5", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-[11px] text-[var(--text-mute)]">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {b.href ? (
                <Link href={b.href} className="hover:text-[var(--text)] transition-colors">
                  {b.label}
                </Link>
              ) : (
                <span className="text-[var(--text-soft)] font-medium">{b.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <ChevronRight size={11} />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-soft)] text-[var(--brand)]">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[var(--text)] truncate">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 text-[12.5px] text-[var(--text-soft)]">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>
        )}
      </div>
    </div>
  );
}
