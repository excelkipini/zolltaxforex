import React from 'react'

interface ZollLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

export function ZollLogo({ size = 'md', showText = true, className = '' }: ZollLogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20'
  }

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl'
  }

  const spaceClasses = {
    sm: 'space-x-2',
    md: 'space-x-3',
    lg: 'space-x-4',
    xl: 'space-x-5'
  }

  return (
    <div className={`flex items-center ${spaceClasses[size]} ${className}`}>
      {/* Formes géométriques représentant le logo */}
      <div className="relative">
        <div className={`${sizeClasses[size]} bg-gradient-to-br from-cyan-400 to-cyan-500 rounded-xl transform rotate-12 shadow-lg`}></div>
        <div className={`${sizeClasses[size]} bg-gradient-to-br from-cyan-400 to-cyan-500 rounded-xl absolute -top-1 -left-1 transform rotate-6 shadow-md`}></div>
        <div className={`${sizeClasses[size]} bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl absolute -top-2 -left-2 shadow-sm`}></div>
      </div>
      
      {/* Texte du logo */}
      {showText && (
        <div className="text-left">
          <div className={`${textSizeClasses[size]} font-bold bg-gradient-to-b from-blue-600 to-blue-800 bg-clip-text text-transparent`}>
            ZOLL
          </div>
          <div className={`${textSizeClasses[size]} font-bold bg-gradient-to-b from-blue-600 to-blue-800 bg-clip-text text-transparent -mt-1`}>
            TAX
          </div>
          <div className={`${textSizeClasses[size]} font-bold bg-gradient-to-b from-blue-600 to-blue-800 bg-clip-text text-transparent -mt-1`}>
            FOREX
          </div>
        </div>
      )}
    </div>
  )
}
