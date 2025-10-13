import { neon } from '@neondatabase/serverless'
import type { User } from '@/lib/types'

const sql = neon(process.env.DATABASE_URL!)

export interface ReceiptData {
  id: string
  receipt_number: string
  client_name: string
  client_phone?: string
  client_email?: string
  operation_type: string
  amount_received: number
  amount_sent: number
  commission: number
  commission_rate: number
  currency: string
  notes?: string
  qr_code_data?: any
  created_by: string
  created_at: string
  updated_at: string
  created_by_name?: string
  card_fees?: number
  number_of_cards?: number
  real_commission?: number
}

export interface CreateReceiptData {
  receipt_number: string
  client_name: string
  client_phone?: string
  client_email?: string
  operation_type: string
  amount_received: number
  amount_sent: number
  commission: number
  commission_rate: number
  currency: string
  notes?: string
  qr_code_data?: any
  created_by: string
  card_fees?: number
  number_of_cards?: number
  real_commission?: number
}

export async function createReceipt(data: CreateReceiptData): Promise<ReceiptData> {
  const result = await sql`
    INSERT INTO receipts (
      receipt_number, client_name, client_phone, client_email, 
      operation_type, amount_received, amount_sent, commission, 
      commission_rate, currency, notes, qr_code_data, created_by,
      card_fees, number_of_cards, real_commission
    ) VALUES (
      ${data.receipt_number}, ${data.client_name}, ${data.client_phone}, ${data.client_email},
      ${data.operation_type}, ${data.amount_received}, ${data.amount_sent}, ${data.commission},
      ${data.commission_rate}, ${data.currency}, ${data.notes}, ${data.qr_code_data}, ${data.created_by},
      ${data.card_fees || 0}, ${data.number_of_cards || 0}, ${data.real_commission || 0}
    )
    RETURNING *
  `
  
  return result[0] as ReceiptData
}

export async function listReceipts(limit: number = 50, offset: number = 0): Promise<ReceiptData[]> {
  const result = await sql`
    SELECT 
      r.*,
      u.name as created_by_name
    FROM receipts r
    LEFT JOIN users u ON r.created_by = u.id
    ORDER BY r.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `
  
  return result as ReceiptData[]
}

export async function getReceiptById(id: string): Promise<ReceiptData | null> {
  const result = await sql`
    SELECT 
      r.*,
      u.name as created_by_name
    FROM receipts r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.id = ${id}
  `
  
  return result[0] as ReceiptData || null
}

export async function getReceiptByNumber(receiptNumber: string): Promise<ReceiptData | null> {
  const result = await sql`
    SELECT 
      r.*,
      u.name as created_by_name
    FROM receipts r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.receipt_number = ${receiptNumber}
  `
  
  return result[0] as ReceiptData || null
}

export async function searchReceipts(query: string, limit: number = 50): Promise<ReceiptData[]> {
  const result = await sql`
    SELECT 
      r.*,
      u.name as created_by_name
    FROM receipts r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE 
      r.receipt_number ILIKE ${`%${query}%`} OR
      r.client_name ILIKE ${`%${query}%`} OR
      r.client_phone ILIKE ${`%${query}%`} OR
      r.client_email ILIKE ${`%${query}%`}
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `
  
  return result as ReceiptData[]
}

export async function getReceiptStats(): Promise<{
  total_receipts: number
  total_amount_received: number
  total_commission: number
  total_amount_sent: number
}> {
  const result = await sql`
    SELECT 
      COUNT(*) as total_receipts,
      COALESCE(SUM(amount_received), 0) as total_amount_received,
      COALESCE(SUM(commission), 0) as total_commission,
      COALESCE(SUM(amount_sent), 0) as total_amount_sent
    FROM receipts
  `
  
  return result[0] as any
}

export async function deleteReceipt(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM receipts WHERE id = ${id}
  `
  
  return result.length > 0
}
