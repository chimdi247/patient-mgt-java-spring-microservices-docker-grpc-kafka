import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { displayName, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/patients", label: "Patients", icon: Users },
];
const adminNav = [{ to: "/system", label: "System", icon: Activity }];

function NavItem({ to, label, icon: Icon, end, onClick }: { to: string; label: string; icon: typeof Users; end?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
          isActive ? "bg-white/10 text-white" : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-white",
        )
      }
    >
      {({ isActive }) => (<><Icon className={cn("h-[18px] w-[18px]", isActive && "text-accent")} />{label}</>)}
    </NavLink>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { session, isAdmin, logout } = useAuth();
  const name = displayName(session?.email);
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <BrandMark className="h-8 w-8" />
        <div>
          <p className="font-display text-xl font-semibold leading-none tracking-tight text-white">CareDesk</p>
          <p className="mt-1 text-[11px] text-sidebar-muted">Patient management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {nav.map((n) => <NavItem key={n.to} {...n} onClick={onNavigate} />)}
        {isAdmin && (
          <>
            <p className="px-3 pb-1 pt-6 text-xs font-semibold text-sidebar-muted">Administration</p>
            {adminNav.map((n) => <NavItem key={n.to} {...n} onClick={onNavigate} />)}
          </>
        )}
      </nav>

      <div className="m-3 flex items-center gap-3 rounded-lg bg-white/5 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{initials(name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-sidebar-muted">
            <Badge variant="secondary" className="bg-white/10 px-1.5 py-0 text-[10px] text-white">{session?.role}</Badge>
            <span className="truncate">{session?.email}</span>
          </p>
        </div>
        <button onClick={logout} className="rounded-md p-2 text-sidebar-muted hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block"><Sidebar /></aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5"><BrandMark className="h-7 w-7" /><span className="font-display text-lg font-semibold text-white">CareDesk</span></div>
        <button onClick={() => setOpen(true)} className="rounded-md p-2 text-white hover:bg-white/10" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-primary/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%]">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-5 z-10 rounded-md p-1 text-white/70 hover:text-white" aria-label="Close menu"><X className="h-5 w-5" /></button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main key={pathname} className="min-w-0 px-4 py-6 sm:px-8 sm:py-9">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
    </div>
  );
}
