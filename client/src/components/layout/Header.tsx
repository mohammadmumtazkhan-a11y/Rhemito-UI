import { Menu } from "lucide-react";
import { Link } from "wouter";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuth } from "@/hooks/use-auth";
import { profileLabel, userInitials, welcomeName } from "@/lib/userDisplay";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || welcomeName(user)
    : "";

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 md:px-7 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 active:scale-95 transition-all -ml-1 text-slate-700"
          data-testid="button-mobile-menu"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/" data-testid="link-logo-home">
          <div className="flex items-center gap-2.5 cursor-pointer">
            <img
              src="/logo.png"
              alt="Rhemito Logo"
              className="w-8 h-8 object-contain"
            />
            <span className="font-display font-bold text-lg text-slate-900 tracking-tight">
              Rhemito
            </span>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-3 md:gap-4 ml-auto">
        <NotificationBell />

        <div
          className="flex items-center gap-3 cursor-pointer"
          data-testid="button-profile-menu"
        >
          <div className="hidden sm:flex flex-col items-end leading-tight">
            {fullName && (
              <span className="text-sm font-medium text-slate-700">
                {fullName}
              </span>
            )}
            <span
              className="text-xs text-slate-400 font-normal"
              data-testid="header-profile-label"
            >
              {profileLabel(user)}
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shadow-xs shrink-0">
            <span
              className="text-white font-semibold text-xs md:text-sm"
              data-testid="header-initials"
            >
              {userInitials(user)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

