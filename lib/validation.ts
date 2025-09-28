import { z } from "zod"

/**
 * Reception/Envoi: builds a schema that optionally enforces a transferLimit max.
 */
export function receptionSchema(transferLimit?: number) {
  return z
    .object({
      type: z.enum(["receive", "send"], { required_error: "Type requis" }),
      currency: z.enum(["XAF", "USD", "EUR"], { required_error: "Devise requise" }),
      client: z.string().optional(),
      phone: z
        .string()
        .optional()
        .refine((v) => !v || /^[0-9+\s().-]{7,20}$/.test(v), "Téléphone invalide"),
      amount: z
        .number({ required_error: "Montant requis", invalid_type_error: "Montant invalide" })
        .positive("Le montant doit être > 0")
        .refine((n) => (transferLimit ? n <= transferLimit : true), {
          message: "Montant supérieur au plafond autorisé",
        }),
    })
    .strict()
}

/**
 * Exchange: at least one of xaf or foreign provided, both >= 0 if provided.
 */
export const exchangeSchema = z
  .object({
    type: z.enum(["buy", "sell"], { required_error: "Type requis" }),
    cur: z.enum(["USD", "EUR", "GBP"], { required_error: "Devise requise" }),
    xaf: z.number().nonnegative("XAF doit être >= 0").optional(),
    foreign: z.number().nonnegative("Montant devise doit être >= 0").optional(),
  })
  .refine((v) => typeof v.xaf === "number" || typeof v.foreign === "number", {
    message: "Saisir au moins XAF ou montant devise",
    path: ["xaf"],
  })

/**
 * Global rates/limits on /rates
 */
export const globalSettingsSchema = z
  .object({
    usd: z.number({ invalid_type_error: "USD invalide" }).positive("USD doit être > 0"),
    eur: z.number({ invalid_type_error: "EUR invalide" }).positive("EUR doit être > 0"),
    gbp: z.number({ invalid_type_error: "GBP invalide" }).positive("GBP doit être > 0"),
    transfer_limit: z
      .number({ invalid_type_error: "Plafond transfert invalide" })
      .int("Doit être un entier")
      .nonnegative("Doit être >= 0"),
    daily_limit: z
      .number({ invalid_type_error: "Limite quotidienne invalide" })
      .int("Doit être un entier")
      .nonnegative("Doit être >= 0"),
    card_limit: z
      .number({ invalid_type_error: "Plafond carte invalide" })
      .int("Doit être un entier")
      .nonnegative("Doit être >= 0"),
    commission: z
      .number({ invalid_type_error: "Commission invalide" })
      .min(0, "Commission min 0%")
      .max(100, "Commission max 100%"),
  })
  .strict()

/**
 * Per-agency overrides: allow null to fallback to global; otherwise validate.
 */
export const agencyOverrideSchema = z
  .object({
    transfer_limit: z.number().int().nonnegative().nullable().optional(),
    daily_limit: z.number().int().nonnegative().nullable().optional(),
    card_limit: z.number().int().nonnegative().nullable().optional(),
    commission: z.number().min(0, "Commission min 0%").max(100, "Commission max 100%").nullable().optional(),
  })
  .strict()

export type FieldErrors = Record<string, string | undefined>

export function zodToFieldErrors(err: unknown): FieldErrors {
  if (!(err instanceof z.ZodError)) return {}
  const out: FieldErrors = {}
  for (const i of err.issues) {
    const key = (i.path?.[0] as string) ?? "form"
    // keep only first message per field
    if (!out[key]) out[key] = i.message
  }
  return out
}
