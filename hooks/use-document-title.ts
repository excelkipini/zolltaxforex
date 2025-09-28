import { useEffect } from 'react'

interface UseDocumentTitleProps {
  title: string
  suffix?: string
}

export function useDocumentTitle({ title, suffix = 'ZOLL TAX FOREX' }: UseDocumentTitleProps) {
  useEffect(() => {
    const fullTitle = suffix ? `${title} | ${suffix}` : title
    document.title = fullTitle
    
    // Mettre à jour aussi la meta description si nécessaire
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute('content', `Système interne de gestion des opérations - ${title}`)
    }
  }, [title, suffix])
}
