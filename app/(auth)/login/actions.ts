"use server"

import { z } from "zod"
import { loginWithCredentials } from "@/lib/auth"
import { redirect } from "next/navigation"

const schema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
})

export async function loginAction(_: any, formData: FormData) {
  const obj = {
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
  }

  try {
    const { email, password } = schema.parse(obj)
    const err = await loginWithCredentials(email, password)
    if (err) {
      return { ok: false, error: err }
    }
    redirect("/dashboard")
  } catch (e: any) {
    return { ok: false, error: e?.message || "Erreur de connexion" }
  }
}
