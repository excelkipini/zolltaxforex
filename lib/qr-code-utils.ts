import QRCode from 'qrcode'

export interface QRCodeOptions {
  width?: number
  height?: number
  colorDark?: string
  colorLight?: string
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
}

export async function generateQRCodeDataURL(
  text: string, 
  options: QRCodeOptions = {}
): Promise<string> {
  const defaultOptions = {
    width: 120,
    height: 120,
    colorDark: '#000000',
    colorLight: '#ffffff',
    errorCorrectionLevel: 'M' as const,
    ...options
  }

  try {
    const dataURL = await QRCode.toDataURL(text, {
      width: defaultOptions.width,
      margin: 2,
      color: {
        dark: defaultOptions.colorDark,
        light: defaultOptions.colorLight,
      },
      errorCorrectionLevel: defaultOptions.errorCorrectionLevel,
    })
    
    return dataURL
  } catch (error) {
    console.error('Erreur lors de la génération du QR code:', error)
    throw new Error('Impossible de générer le QR code')
  }
}

export async function generateQRCodeSVG(
  text: string, 
  options: QRCodeOptions = {}
): Promise<string> {
  const defaultOptions = {
    width: 120,
    height: 120,
    colorDark: '#000000',
    colorLight: '#ffffff',
    errorCorrectionLevel: 'M' as const,
    ...options
  }

  try {
    const svg = await QRCode.toString(text, {
      type: 'svg',
      width: defaultOptions.width,
      margin: 2,
      color: {
        dark: defaultOptions.colorDark,
        light: defaultOptions.colorLight,
      },
      errorCorrectionLevel: defaultOptions.errorCorrectionLevel,
    })
    
    return svg
  } catch (error) {
    console.error('Erreur lors de la génération du QR code SVG:', error)
    throw new Error('Impossible de générer le QR code SVG')
  }
}
