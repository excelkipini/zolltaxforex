export type AppUser = {
  id: string
  name: string
  email: string
  role: "super_admin" | "director" | "accounting" | "cashier" | "auditor" | "delegate"
  agency: string
  last_login?: string
}

const USERS_KEY = "maf:users"

export function loadUsers(fallback: readonly AppUser[] = [] as any): AppUser[] {
  if (typeof window === "undefined") return [...(fallback as any)]
  try {
    const raw = window.localStorage.getItem(USERS_KEY)
    if (!raw) return [...(fallback as any)]
    const parsed = JSON.parse(raw) as AppUser[]
    return Array.isArray(parsed) ? parsed : [...(fallback as any)]
  } catch {
    return [...(fallback as any)]
  }
}

export function saveUsers(users: AppUser[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users))
  } catch {
    // ignore storage errors
  }
}

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-expect-error randomUUID exists in modern browsers
    return crypto.randomUUID() as string
  }
  return `u_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}
