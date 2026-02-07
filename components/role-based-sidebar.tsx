"use client"

import * as React from "react"
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
  ChevronDown,
  ChevronRight,
  BarChart3,
  Upload,
  List,
} from "lucide-react"
import type { SessionUser } from "@/lib/auth-client"
import { hasPermission, getRoleDisplayName } from "@/lib/rbac"
import { ZollLogo } from "@/components/ui/zoll-logo"

interface RoleBasedSidebarProps {
  user: SessionUser
}

export function RoleBasedSidebar({ user }: RoleBasedSidebarProps) {
  const pathname = usePathname()
  const [openSubmenus, setOpenSubmenus] = React.useState<Record<string, boolean>>({})

  // Ouvrir le sous-menu "Transfert d'argent" quand on est sur /transfer ou /transfer/operations
  React.useEffect(() => {
    if (pathname === "/transfer" || pathname.startsWith("/transfer/")) {
      setOpenSubmenus(prev => ({ ...prev, "Transfert d'argent": true }))
    }
  }, [pathname])
  // Ouvrir le sous-menu "Bureau de change" quand on est sur /exchange ou /exchange/management
  React.useEffect(() => {
    if (pathname === "/exchange" || pathname.startsWith("/exchange/")) {
      setOpenSubmenus(prev => ({ ...prev, "Bureau de change": true }))
    }
  }, [pathname])
  // Ouvrir le sous-menu "Arrêtés de Caisse" quand on est sur /ria ou /ria/paris
  React.useEffect(() => {
    if (pathname === "/ria" || pathname.startsWith("/ria/")) {
      setOpenSubmenus(prev => ({ ...prev, "Arrêtés de Caisse": true }))
    }
  }, [pathname])

  const toggleSubmenu = (itemTitle: string) => {
    setOpenSubmenus(prev => ({
      ...prev,
      [itemTitle]: !prev[itemTitle]
    }))
  }

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
      primary: user.role === "cashier" || user.role === "director" || user.role === "delegate",
      submenu: [
        { title: "Effectuer un transfert", href: "/transfer", permission: "view_transfer" as const },
        { title: "Opérations", href: "/transfer/operations", permission: "view_transfer" as const },
      ],
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
      submenu: [
        { title: "Nouvelle opération de change", href: "/exchange", permission: "view_exchange" as const },
        { title: "Caisse", href: "/exchange/management", permission: "view_exchange" as const },
      ],
    },
    {
      title: "Dépenses",
      href: "/expenses",
      icon: Receipt,
      permission: "view_expenses" as const,
      primary: user.role === "accounting" || user.role === "director" || user.role === "delegate",
    },
    {
      title: "Opérations",
      href: "/transactions",
      icon: Activity,
      permission: "view_transactions" as const,
      primary: user.role === "director" || user.role === "delegate" || user.role === "accounting",
    },
    {
      title: "Transfert International",
      href: "/receipt",
      icon: Receipt,
      permission: "view_receipts" as const,
      primary: user.role === "cashier" || user.role === "accounting" || user.role === "director" || user.role === "delegate",
    },
    {
      title: "Caisse",
      href: "/cash",
      icon: Wallet,
      permission: "view_cash" as const,
      primary: user.role === "accounting" || user.role === "director" || user.role === "delegate",
    },
    {
      title: "Arrêtés de Caisse",
      href: "/ria",
      icon: BarChart3,
      permission: "view_ria_dashboard" as const,
      primary: user.role === "cash_manager",
      submenu: [
        { title: "Congo", href: "/ria", permission: "view_ria_dashboard" as const },
        { title: "Paris", href: "/ria/paris", permission: "view_ria_dashboard" as const },
      ],
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

  // Logique spéciale pour l'auditeur - ne montrer que Tableau de bord, Opérations, Dépenses, Utilisateurs et Taux & Plafonds
  const visibleMenuItems = user.role === "auditor" 
    ? [
        menuItems.find((item) => item.href === "/dashboard"),
        menuItems.find((item) => item.href === "/transactions"),
        menuItems.find((item) => item.href === "/expenses"),
        menuItems.find((item) => item.href === "/ria"),
        menuItems.find((item) => item.href === "/users"),
        menuItems.find((item) => item.href === "/rates")
      ].filter(Boolean) // Supprimer les undefined
    : menuItems.filter((item) => {
        // Vérifier la permission principale
        if (!hasPermission(user, item.permission)) return false
        
        // Si l'item a un sous-menu, vérifier qu'au moins un sous-menu est accessible
        if (item.submenu && item.submenu.length > 0) {
          return item.submenu.some(subItem => hasPermission(user, subItem.permission))
        }
        
        return true
      })
  
  const visibleAdminItems = adminItems.filter((item) => hasPermission(user, item.permission))

  return (
    <div className="flex h-full w-64 flex-col border-r bg-slate-50/50 dark:bg-slate-950/50">
      {/* Header */}
      <div className="shrink-0 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 mb-2">
              <ZollLogo size="sm" showText={false} />
              <h2 className="text-base font-semibold truncate text-slate-900 dark:text-slate-100">ZOLL TAX FOREX</h2>
            </div>
            <Badge variant="secondary" className="text-xs font-medium">
              {getRoleDisplayName(user.role)}
            </Badge>
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

      <Separator className="bg-slate-200 dark:bg-slate-800" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        {/* Section principale */}
        <div className="mb-2 px-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/90">
            Menu principal
          </span>
        </div>
        <div className="space-y-0.5">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const hasSubmenu = item.submenu && item.submenu.length > 0
            const isSubmenuOpen = openSubmenus[item.title] ?? false

            const isSubmenuActive = hasSubmenu && item.submenu?.some(subItem => pathname === subItem.href)
            const isMainActive = isActive || isSubmenuActive

            if (hasSubmenu) {
              return (
                <div key={item.title} className="rounded-lg">
                  <Button
                    variant="ghost"
                    className={cn(
                      "h-10 w-full justify-between rounded-lg px-3 font-medium transition-colors",
                      !isMainActive && "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80",
                      isMainActive && "bg-primary/10 dark:bg-primary/20 text-primary font-semibold hover:bg-primary/15 dark:hover:bg-primary/25 border-l-2 border-primary -ml-[2px] pl-[14px]"
                    )}
                    onClick={() => toggleSubmenu(item.title)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
                        isMainActive ? "bg-primary text-primary-foreground" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span>{item.title}</span>
                    </div>
                    {isSubmenuOpen ? (
                      <ChevronDown className={cn("h-4 w-4 shrink-0", isMainActive ? "text-primary" : "text-muted-foreground")} />
                    ) : (
                      <ChevronRight className={cn("h-4 w-4 shrink-0", isMainActive ? "text-primary" : "text-muted-foreground")} />
                    )}
                  </Button>

                  {isSubmenuOpen && (
                    <div className="ml-3 mt-0.5 border-l border-slate-200 dark:border-slate-700 pl-3 py-1 space-y-0.5">
                      {item.submenu?.filter(subItem => hasPermission(user, subItem.permission)).map((subItem) => {
                        const isSubActive = pathname === subItem.href
                        return (
                          <Link key={subItem.href} href={subItem.href}>
                            <span
                              className={cn(
                                "block rounded-md px-3 py-2 text-sm transition-colors",
                                !isSubActive && "text-muted-foreground hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800/50",
                                isSubActive && "bg-primary/15 text-primary font-semibold border-l-2 border-primary -ml-0.5 pl-[11px] hover:bg-primary/20 hover:text-primary"
                              )}
                            >
                              {subItem.title}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-10 w-full justify-start rounded-lg px-3 font-medium transition-colors",
                    !isActive && "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80",
                    isActive && "bg-primary/10 dark:bg-primary/20 text-primary font-semibold hover:bg-primary/15 dark:hover:bg-primary/25 border-l-2 border-primary -ml-[2px] pl-[14px]"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md mr-3 transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {item.title}
                </Button>
              </Link>
            )
          })}
        </div>

        {/* Section Administration */}
        {visibleAdminItems.length > 0 && (
          <>
            <Separator className="my-4 bg-slate-200 dark:bg-slate-800" />
            <div className="mb-2 px-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/90">
                Administration
              </span>
            </div>
            <div className="space-y-0.5">
              {visibleAdminItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "h-10 w-full justify-start rounded-lg px-3 font-medium transition-colors",
                        !isActive && "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80",
                        isActive && "bg-primary/10 dark:bg-primary/20 text-primary font-semibold hover:bg-primary/15 dark:hover:bg-primary/25 border-l-2 border-primary -ml-[2px] pl-[14px]"
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md mr-3 transition-colors",
                        isActive ? "bg-primary text-primary-foreground" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {item.title}
                    </Button>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </nav>

      {/* User Info + Logout */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-3">
        <div className="text-sm min-w-0">
          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{user.name}</div>
          <div className="text-muted-foreground text-xs truncate">{user.email}</div>
        </div>
        <Button
          variant="outline"
          size="sm"
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
