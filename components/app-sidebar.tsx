"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Home, CreditCard, BadgeDollarSign, Receipt, FileText, Users, Building2, Gauge, ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export function AppSidebar() {
  const { state } = useSidebar()
  const pathname = usePathname()

  const mainNav = [
    { title: "Tableau de bord", icon: Home, href: "/dashboard" },
    { title: "Gestion Cartes", icon: CreditCard, href: "/cards" },
    { title: "Bureau de change", icon: BadgeDollarSign, href: "/exchange" },
    { title: "Dépenses", icon: Receipt, href: "/expenses" },
    { title: "Comptabilité/Rapports", icon: FileText, href: "/reports" },
  ] as const

  const adminNav = [
    { title: "Utilisateurs", icon: Users, href: "/users" },
    { title: "Agences", icon: Building2, href: "/agencies" },
    { title: "Taux & Plafonds", icon: Gauge, href: "/rates" },
  ] as const

  return (
    <Sidebar variant="sidebar" collapsible="offcanvas" className="bg-white">
      <SidebarHeader className="border-b">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">ZOLL TAX FOREX</div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={state === "collapsed" ? item.title : undefined}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center">
                Administration
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNav.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.href}>
                            <Icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="px-2 text-xs text-muted-foreground">v1.0.0</div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
