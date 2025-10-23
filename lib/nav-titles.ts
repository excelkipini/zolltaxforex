export type Locale = "fr" | "en"

const TITLES: Record<Locale, Record<string, string>> = {
  fr: {
    "/dashboard": "Tableau de bord",
    "/cards": "Gestion des cartes prépayées",
    "/exchange": "Bureau de change",
    "/expenses": "Gestion des dépenses",
    "/transactions": "Opérations",
    "/cash": "Gestion de la Caisse",
    "/reports": "Comptabilité & Rapports",
    "/users": "Gestion des utilisateurs",
    "/agencies": "Gestion des agences",
    "/rates": "Gestion des taux & plafonds",
    "/receipt": "Transfert International",
    "/cash-settlements": "Arrêté de caisse",
  },
  en: {
    "/dashboard": "Dashboard",
    "/cards": "Prepaid Cards Management",
    "/exchange": "Currency Exchange",
    "/expenses": "Expenses Management",
    "/transactions": "Operations",
    "/cash": "Cash Management",
    "/reports": "Accounting & Reports",
    "/users": "User Management",
    "/agencies": "Agencies Management",
    "/rates": "Rates & Limits",
    "/receipt": "Issue Receipt",
  },
}

/**
 * Detect locale from pathname prefix (/fr/... or /en/...). Defaults to "fr".
 */
function detectLocale(pathname: string): Locale {
  const segments = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean)
  const maybe = (segments[0] || "").toLowerCase()
  return (["fr", "en"] as const).includes(maybe as Locale) ? (maybe as Locale) : "fr"
}

/**
 * Normalize a pathname like "/fr/dashboard/..." to its route key (e.g. "/dashboard").
 */
function getRouteKey(pathname: string): string {
  const segments = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean)
  let idx = 0
  if (segments.length && ["fr", "en"].includes(segments[0]?.toLowerCase())) {
    idx = 1
  }
  const route = `/${segments[idx] ?? "dashboard"}`
  return route
}

/**
 * Return the navigation title for a given pathname and optional locale.
 * If locale is not provided, it will be auto-detected from the URL prefix.
 */
export function getNavTitle(pathname: string, locale?: Locale): string {
  const loc = locale ?? detectLocale(pathname)
  const routeKey = getRouteKey(pathname)
  return TITLES[loc][routeKey] ?? TITLES[loc]["/dashboard"]
}
