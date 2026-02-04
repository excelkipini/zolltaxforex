"use client"

interface PageLoaderProps {
  /** Message affiché sous le spinner (optionnel) */
  message?: string
  /** Utiliser un overlay fixe plein écran (comme Opérations transfert) ou un bloc centré dans le contenu */
  overlay?: boolean
  /** Pour overlay: hauteur min du conteneur parent (évite collapse) */
  className?: string
}

/**
 * Loader de page unifié : même style que "Opérations - Transfert d'argent".
 * - overlay: true → fond blanc/80 + blur, centré (pour contenu qui charge après rendu)
 * - overlay: false → bloc centré dans le flux (pour pages qui ne rendent rien avant la fin du chargement)
 */
export function PageLoader({ message = "Chargement...", overlay = true, className }: PageLoaderProps) {
  const content = (
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600" />
      <span className="text-sm font-medium text-gray-700">{message}</span>
    </div>
  )

  if (overlay) {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm ${className ?? ""}`}
        aria-live="polite"
        aria-busy="true"
      >
        {content}
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-center min-h-[280px] ${className ?? ""}`}
      aria-live="polite"
      aria-busy="true"
    >
      {content}
    </div>
  )
}
