"use client";

import { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: "sm" | "md" | "lg" | "xl" | "full";
}

const roundedMap = {
  sm: "rounded",
  md: "rounded-[var(--radius-sm)]",
  lg: "rounded-[var(--radius-md)]",
  xl: "rounded-[var(--radius-lg)]",
  full: "rounded-full",
};

export function Skeleton({ rounded = "md", className, ...rest }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[var(--bg-subtle)]",
        roundedMap[rounded],
        className,
      )}
      {...rest}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4", className)}>
      <div className="flex items-center gap-3">
        <Skeleton rounded="lg" className="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={3} className="mt-4" />
    </div>
  );
}
