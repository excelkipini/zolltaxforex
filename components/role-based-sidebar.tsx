"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut } from "lucide-react"
import {
  LayoutDashboard,
  Send,
  CreditCard,
  Banknote,
  Receipt,
  Activity,
  Wallet,
  FileText,
  Users,
  Building2,
  Settings,
  Plus,
} from "lucide-react"
import type { SessionUser } from "@/lib/auth-client"
import { hasPermission, getRoleDisplayName } from "@/lib/rbac"
import { ZollLogo } from "@/components/ui/zoll-logo"

interface RoleBasedSidebarProps {
  user: SessionUser
}

export function RoleBasedSidebar({ user }: RoleBasedSidebarProps) {
  const pathname = usePathname()

  const menuItems = [
    {
      title: "Tableau de bord",
      href: "/dashboard",
      icon: LayoutDashboard,
      permission: "view_dashboard" as const,
      primary: false,
    },
    {
      title: "Transfert d'argent",
      href: "/transfer",
      icon: Send,
      permission: "view_transfer" as const,
      primary: user.role === "cashier",
    },
    {
      title: "Gestion Cartes",
      href: "/cards",
      icon: CreditCard,
      permission: "view_cards" as const,
      primary: false,
    },
    {
      title: "Bureau de change",
      href: "/exchange",
      icon: Banknote,
      permission: "view_exchange" as const,
      primary: false,
    },
    {
      title: "Dépenses",
      href: "/expenses",
      icon: Receipt,
      permission: "view_expenses" as const,
      primary: user.role === "accounting",
    },
    {
      title: "Opérations",
      href: "/transactions",
      icon: Activity,
      permission: "view_transactions" as const,
      primary: user.role === "director" || user.role === "accounting",
    },
    {
      title: "Caisse",
      href: "/cash",
      icon: Wallet,
      permission: "view_cash" as const,
      primary: user.role === "accounting",
    },
    {
      title: "Rapports",
      href: "/reports",
      icon: FileText,
      permission: "view_reports" as const,
      primary: user.role === "accounting" || user.role === "director" || user.role === "delegate",
    },
  ]

  const adminItems = [
    {
      title: "Utilisateurs",
      href: "/users",
      icon: Users,
      permission: "view_users" as const,
    },
    {
      title: "Agences",
      href: "/agencies",
      icon: Building2,
      permission: "view_agencies" as const,
    },
    {
      title: "Taux & Plafonds",
      href: "/rates",
      icon: Settings,
      permission: "view_rates" as const,
    },
  ]

  const quickActions = [
    {
      title: "Nouvelle transaction",
      href: "/reception",
      permission: "create_reception" as const,
      roles: ["cashier"],
    },
    {
      title: "Nouvelle dépense",
      href: "/expenses",
      permission: "create_expenses" as const,
      roles: ["accounting"],
    },
    {
      title: "Rapport du jour",
      href: "/reports",
      permission: "view_reports" as const,
      roles: ["director", "delegate"],
    },
  ]

  // Logique spéciale pour l'auditeur - ne montrer que Tableau de bord, Opérations, Dépenses, Utilisateurs et Taux & Plafonds
  const visibleMenuItems = user.role === "auditor" 
    ? [
        menuItems.find((item) => item.href === "/dashboard"),
        menuItems.find((item) => item.href === "/transactions"),
        menuItems.find((item) => item.href === "/expenses"),
        menuItems.find((item) => item.href === "/users"),
        menuItems.find((item) => item.href === "/rates")
      ].filter(Boolean) // Supprimer les undefined
    : menuItems.filter((item) => hasPermission(user, item.permission))
  
  const visibleAdminItems = adminItems.filter((item) => hasPermission(user, item.permission))
  const visibleQuickActions = quickActions.filter(
    (action) => hasPermission(user, action.permission) && action.roles.includes(user.role),
  )

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ZollLogo size="sm" showText={false} />
              <h2 className="text-lg font-semibold">ZOLL TAX FOREX</h2>
            </div>
            <div>
              <Badge variant="secondary">
                {getRoleDisplayName(user.role)}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full" aria-label="Compte">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await fetch("/api/auth/logout", { method: "POST" })
                    try { localStorage.removeItem("maf_session") } catch {}
                    window.location.href = "/login"
                  } catch (e) {
                  }
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Déconnexion</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn("w-full justify-start", isActive && "bg-blue-50 text-blue-700 hover:bg-blue-100")}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.title}
              </Button>
            </Link>
          )
        })}

        {/* Admin Section */}
        {visibleAdminItems.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="px-2 py-1">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Administration</h3>
            </div>
            {visibleAdminItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn("w-full justify-start", isActive && "bg-blue-50 text-blue-700 hover:bg-blue-100")}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.title}
                  </Button>
                </Link>
              )
            })}
          </>
        )}

        {/* Quick Actions */}
        {visibleQuickActions.length > 0 && user.role !== "cashier" && (
          <>
            <Separator className="my-4" />
            <div className="px-2 py-1">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions rapides</h3>
            </div>
            {visibleQuickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <Button variant="outline" className="w-full justify-start border-dashed bg-transparent">
                  <Plus className="mr-2 h-4 w-4" />
                  {action.title}
                </Button>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User Info + Logout */}
      <div className="border-t p-4 space-y-3">
        <div className="text-sm">
          <div className="font-medium">{user.name}</div>
          <div className="text-gray-500">{user.email}</div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-center"
          onClick={async () => {
            try {
              await fetch("/api/auth/logout", { method: "POST" })
              try { localStorage.removeItem("maf_session") } catch {}
              window.location.href = "/login"
            } catch (e) {
            }
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </div>
  )
}
