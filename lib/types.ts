export type ActiveView =
  | "dashboard"
  | "reception"
  | "cards"
  | "exchange"
  | "expenses"
  | "reports"
  | "users"
  | "agencies"
  | "rates"

export type Role = "super_admin" | "director" | "accounting" | "cashier" | "auditor" | "delegate"

export type AgencyStatus = "active" | "inactive"

export type Agency = {
  id: string
  name: string
  country: string
  address: string
  status: AgencyStatus
  users: number
}

export type AgencyRef = { id: string; name: string }

export type AppUser = {
  id: string
  name: string
  email: string
  role: Role
  last_login?: string
  // Many-to-many: list of agencies the user works in
  agencies: AgencyRef[]
}
