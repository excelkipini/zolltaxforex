import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { GlobalLogout } from '@/components/global-logout'

export const metadata: Metadata = {
  title: {
    default: 'ZOLL TAX FOREX',
    template: '%s | ZOLL TAX FOREX'
  },
  description: 'Système interne de gestion des opérations',
  generator: 'ZOLL TAX FOREX',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' }
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.svg'
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <GlobalLogout />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
