import { type NextRequest, NextResponse } from "next/server"
import { loginWithCredentials } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ message: "Email et mot de passe requis" }, { status: 400 })
    }

    const error = await loginWithCredentials(email, password)

    if (error) {
      return NextResponse.json({ message: error }, { status: 401 })
    }

    return NextResponse.json({ message: "Connexion réussie" }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 })
  }
}
