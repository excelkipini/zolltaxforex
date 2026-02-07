"use client"

import * as React from "react"
import { RiaCashClosure } from "./ria-cash-closure"

export function RiaParisView() {
  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold">Arrêtés de Caisse — Paris</h1>
        <p className="text-gray-600">
          Clôture de caisse et gestion des arrêtés de la branche Paris (en euros)
        </p>
      </div>

      {/* Clôture de caisse (Paris) */}
      <RiaCashClosure region="paris" />
    </div>
  )
}
