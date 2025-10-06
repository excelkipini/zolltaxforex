import { useState, useCallback } from 'react'

interface UseQRCodeOptions {
  width?: number
  height?: number
  colorDark?: string
  colorLight?: string
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
}

interface UseQRCodeReturn {
  qrCodeDataURL: string | null
  isLoading: boolean
  error: string | null
  generateQRCode: (text: string, options?: UseQRCodeOptions) => Promise<void>
}

export function useQRCode(): UseQRCodeReturn {
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateQRCode = useCallback(async (text: string, options: UseQRCodeOptions = {}) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/qr-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, options }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la génération du QR code')
      }

      setQrCodeDataURL(data.qrCodeDataURL)
    } catch (err: any) {
      setError(err.message)
      setQrCodeDataURL(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    qrCodeDataURL,
    isLoading,
    error,
    generateQRCode,
  }
}
