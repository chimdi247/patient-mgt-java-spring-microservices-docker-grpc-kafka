export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="hsl(var(--accent))" />
      <path d="M26 14h12v12h12v12H38v12H26V38H14V26h12z" fill="hsl(var(--primary))" />
    </svg>
  );
}
