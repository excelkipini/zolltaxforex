import { NextRequest, NextResponse } from 'next/server'
import { generateQRCodeDataURL } from '@/lib/qr-code-utils'

export async function POST(request: NextRequest) {
  try {
    const { text, options = {} } = await request.json()

    if (!text) {
      return NextResponse.json(
        { error: 'Le texte est requis pour générer le QR code' },
        { status: 400 }
      )
    }

    const qrCodeDataURL = await generateQRCodeDataURL(text, options)

    return NextResponse.json({
      success: true,
      qrCodeDataURL,
      text
    })

  } catch (error: any) {
    console.error('Erreur lors de la génération du QR code:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
