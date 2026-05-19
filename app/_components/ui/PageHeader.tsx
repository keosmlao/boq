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
    <div className={cn("mb-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-[11px] text-[var(--theme-text-soft)]">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {b.href ? (
                <Link href={b.href} className="hover:text-[var(--theme-primary)]">
                  {b.label}
                </Link>
              ) : (
                <span className="text-[var(--theme-text)] font-medium">{b.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <ChevronRight size={11} />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="theme-icon-badge flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--theme-text)] truncate">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 text-[12px] text-[var(--theme-text-soft)]">{description}</p>
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
