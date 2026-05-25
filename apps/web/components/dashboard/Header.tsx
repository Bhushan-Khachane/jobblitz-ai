"use client";

import { Bell, Menu, Search, LogOut, User, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-lg border-b border-border px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left: mobile menu + search */}
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick} className="lg:hidden p-2 text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2 bg-muted rounded-lg px-3 py-2 w-64">
            <Search className="w-4 h-4 text-muted-foreground/70" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent text-sm outline-none flex-1 text-foreground placeholder:text-muted-foreground/70"
            />
          </div>
        </div>

        {/* Right: notifications + avatar */}
        <div className="flex items-center gap-4">
          <button className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-muted rounded-lg px-2 py-1.5">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-sm font-medium text-foreground">
                  {user?.name || "User"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => (window.location.href = "/profile")}>
                <User className="w-4 h-4 mr-2" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => (window.location.href = "/billing")}>
                <Settings className="w-4 h-4 mr-2" /> Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
