"use client"

import { useEffect } from 'react'

interface PageTitleProps {
  title: string
  suffix?: string
}

export function PageTitle({ title, suffix = 'ZOLL TAX FOREX' }: PageTitleProps) {
  useEffect(() => {
    const fullTitle = suffix ? `${title} | ${suffix}` : title
    document.title = fullTitle
    
    // Mettre à jour aussi la meta description si nécessaire
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute('content', `Système interne de gestion des opérations - ${title}`)
    }
  }, [title, suffix])

  return null // Ce composant ne rend rien visuellement
}
