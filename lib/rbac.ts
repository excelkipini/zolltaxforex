export type Role = "super_admin" | "director" | "delegate" | "accounting" | "cashier" | "auditor" | "executor"

export type Permission =
  | "view_dashboard"
  | "view_users"
  | "create_users"
  | "edit_users"
  | "delete_users"
  | "view_agencies"
  | "create_agencies"
  | "edit_agencies"
  | "delete_agencies"
  | "view_transactions"
  | "create_transactions"
  | "edit_transactions"
  | "delete_transactions"
  | "execute_transactions"
  | "view_reception"
  | "create_reception"
  | "edit_reception"
  | "delete_reception"
  | "view_transfer"
  | "create_transfer"
  | "edit_transfer"
  | "delete_transfer"
  | "view_exchange"
  | "create_exchange"
  | "edit_exchange"
  | "delete_exchange"
  | "view_cards"
  | "create_cards"
  | "edit_cards"
  | "delete_cards"
  | "view_rates"
  | "create_rates"
  | "edit_rates"
  | "delete_rates"
  | "view_expenses"
  | "create_expenses"
  | "edit_expenses"
  | "delete_expenses"
  | "view_reports"
  | "create_reports"
  | "edit_reports"
  | "delete_reports"
  | "view_settings"
  | "edit_settings"

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    "view_dashboard",
    "view_users",
    "create_users",
    "edit_users",
    "delete_users",
    "view_agencies",
    "create_agencies",
    "edit_agencies",
    "delete_agencies",
    "view_transactions",
    "create_transactions",
    "edit_transactions",
    "delete_transactions",
    "view_exchange",
    "create_exchange",
    "edit_exchange",
    "delete_exchange",
    "view_cards",
    "create_cards",
    "edit_cards",
    "delete_cards",
    "view_rates",
    "create_rates",
    "edit_rates",
    "delete_rates",
    "view_expenses",
    "create_expenses",
    "edit_expenses",
    "delete_expenses",
    "view_reports",
    "create_reports",
    "edit_reports",
    "delete_reports",
    "view_settings",
    "edit_settings",
  ],
  director: [
    "view_dashboard",
    "view_users",
    "create_users",
    "edit_users",
    "delete_users",
    "view_agencies",
    "create_agencies",
    "edit_agencies",
    "view_transactions",
    "view_cards",
    "view_rates",
    "edit_rates",
    "view_expenses",
    "view_reports",
    "create_reports",
    "edit_reports",
  ],
  delegate: [
    "view_dashboard",
    "view_users",
    "edit_users",
    "view_agencies",
    "view_transactions",
    "view_cards",
    "view_rates",
    "view_expenses",
    "edit_expenses",
    "view_reports",
    "create_reports",
  ],
  accounting: [
    "view_dashboard",
    "view_transactions",
    "view_rates",
    "edit_rates",
    "view_expenses",
    "create_expenses",
    "edit_expenses",
    "delete_expenses",
    "view_reports",
    "create_reports",
    "edit_reports",
  ],
  cashier: [
    "view_dashboard",
    "view_transactions",
    "create_transactions",
    "view_transfer",
    "create_transfer",
    "edit_transfer",
    "view_exchange",
    "create_exchange",
    "edit_exchange",
    "view_expenses",
    "create_expenses",
  ],
  auditor: [
    "view_dashboard",
    "view_users", // Consultation seule - pas de create/edit/delete
    "view_transactions",
    "edit_transactions", // Pour valider/rejeter les transactions
    "view_cards",
    "view_rates", // Consultation seule - pas d'edit
    "view_expenses",
    "view_reports",
  ],
  executor: [
    "view_dashboard",
    "view_transactions",
    "execute_transactions", // Pour exécuter les transactions validées
    "view_expenses",
  ],
}

export function hasPermission(user: { role: Role } | Role, permission: Permission): boolean {
  const role = typeof user === "string" ? user : user.role
  return ROLE_PERMISSIONS[role]?.includes(permission) || false
}

export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

export function getAccessibleMenus(role: Role): string[] {
  const permissions = getRolePermissions(role)
  const menus: string[] = []

  if (permissions.includes("view_dashboard")) menus.push("dashboard")
  if (permissions.includes("view_users")) menus.push("users")
  if (permissions.includes("view_agencies")) menus.push("agencies")
  if (permissions.includes("view_exchange")) menus.push("exchange")
  if (permissions.includes("view_cards")) menus.push("cards")
  if (permissions.includes("view_rates")) menus.push("rates")
  if (permissions.includes("view_expenses")) menus.push("expenses")
  if (permissions.includes("view_reports")) menus.push("reports")
  if (permissions.includes("view_settings")) menus.push("settings")
  if (permissions.includes("view_transactions")) menus.push("transactions")

  return menus
}

export function canAccess(role: Role, resource: string, action: string): boolean {
  const permission = `${action}_${resource}` as Permission
  return hasPermission(role, permission)
}

export function getRoleDisplayName(role: Role): string {
  const names: Record<Role, string> = {
    super_admin: "Super Administrateur",
    director: "Directeur",
    delegate: "Délégué",
    accounting: "Comptable",
    cashier: "Caissier",
    auditor: "Auditeur",
    executor: "Exécuteur",
  }
  return names[role] || role
}

export function getRolePrimaryActions(role: Role): Array<{ label: string; href: string }> {
  const actions: Record<Role, Array<{ label: string; href: string }>> = {
    cashier: [
      { label: "Nouveau transfert", href: "/transfer" },
      { label: "Opération change", href: "/exchange" },
    ],
    accounting: [
      { label: "Nouvelle dépense", href: "/expenses" },
      { label: "Générer rapport", href: "/reports" },
      { label: "Valider dépenses", href: "/expenses" },
    ],
    director: [
      { label: "Rapport du jour", href: "/reports" },
      { label: "Gérer utilisateurs", href: "/users" },
      { label: "Configurer taux", href: "/rates" },
    ],
    delegate: [
      { label: "Superviser équipe", href: "/users" },
      { label: "Rapport d'activité", href: "/reports" },
      { label: "Gérer dépenses", href: "/expenses" },
    ],
    auditor: [
      { label: "Contrôle conformité", href: "/reports" },
      { label: "Vérifier comptes", href: "/expenses" },
      { label: "Audit système", href: "/users" },
    ],
    super_admin: [
      { label: "Gérer système", href: "/users" },
      { label: "Configuration", href: "/rates" },
      { label: "Supervision globale", href: "/agencies" },
    ],
    executor: [
      { label: "Exécuter transferts", href: "/transactions" },
      { label: "Voir opérations", href: "/transactions" },
    ],
  }
  return actions[role] || []
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Administration système complète, gestion de tous les utilisateurs et paramètres",
  director: "Supervision globale, gestion des utilisateurs et configuration des taux",
  delegate: "Gestion opérationnelle étendue, supervision d'équipes et validation d'opérations",
  accounting: "Gestion financière, validation des dépenses et génération de rapports comptables",
  cashier: "Interface opérationnelle pour transferts d'argent, cartes et opérations de change",
  auditor: "Contrôle et audit en mode lecture seule, génération de rapports de conformité",
  executor: "Exécution des transferts d'argent validés par les auditeurs",
}
