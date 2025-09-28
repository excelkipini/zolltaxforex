"use client"

import type { ReactNode } from "react"
import { hasPermission, type Permission } from "@/lib/rbac"
import type { SessionUser } from "@/lib/auth"

function normalizePermission(input?: string): Permission | undefined {
  if (!input) return undefined
  // If a route like "/expenses" is provided, map to view permission
  if (input.startsWith("/")) {
    const key = input.replace(/^\/+/, "")
    return (`view_${key}` as unknown) as Permission
  }
  // Accept both "resource:action" and "action_resource" formats
  if (input.includes(":")) {
    const [resource, action] = input.split(":")
    return (`${action}_${resource}` as unknown) as Permission
  }
  // Already in "action_resource" form
  return (input as unknown) as Permission
}

interface PermissionGuardProps {
  user: SessionUser
  // Accept flexible inputs; normalize at runtime
  permission?: string
  route?: string
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGuard({ user, permission, route, children, fallback = null }: PermissionGuardProps) {
  const normalized = normalizePermission(route ?? permission)
  if (!normalized || !hasPermission(user, normalized)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface ActionGuardProps {
  user: SessionUser
  permission: string
  children: ReactNode
  fallback?: ReactNode
}

export function ActionGuard({ user, permission, children, fallback = null }: ActionGuardProps) {
  const normalized = normalizePermission(permission)
  if (!normalized || !hasPermission(user, normalized)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface ReadOnlyWrapperProps {
  user: SessionUser
  editPermission: string
  children: ReactNode
}

export function ReadOnlyWrapper({ user, editPermission, children }: ReadOnlyWrapperProps) {
  const normalized = normalizePermission(editPermission)
  const canEdit = normalized ? hasPermission(user, normalized) : false

  if (!canEdit) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gray-50/50 z-10 pointer-events-none" />
        <div className="relative opacity-75">{children}</div>
        <div className="absolute top-4 right-4 z-20">
          <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
            Mode lecture seule
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
