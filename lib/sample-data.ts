export const sampleCards = [
  { id: 1, card_number: "5167XXXX1234", limit: 50000, balance: 50000, status: "available", imported_at: "2023-06-08" },
  { id: 2, card_number: "5167XXXX5678", limit: 50000, balance: 25000, status: "partial", imported_at: "2023-06-08" },
  { id: 3, card_number: "5167XXXX9012", limit: 50000, balance: 0, status: "used", imported_at: "2023-06-07" },
  { id: 4, card_number: "5167XXXX3456", limit: 50000, balance: 50000, status: "available", imported_at: "2023-06-07" },
  { id: 5, card_number: "5167XXXX7890", limit: 50000, balance: 10000, status: "partial", imported_at: "2023-06-06" },
  { id: 6, card_number: "5167XXXX2345", limit: 50000, balance: 50000, status: "available", imported_at: "2023-06-06" },
  { id: 7, card_number: "5167XXXX6789", limit: 50000, balance: 0, status: "used", imported_at: "2023-06-05" },
  { id: 8, card_number: "5167XXXX0123", limit: 50000, balance: 40000, status: "partial", imported_at: "2023-06-05" },
  { id: 9, card_number: "5167XXXX4567", limit: 50000, balance: 50000, status: "available", imported_at: "2023-06-04" },
  { id: 10, card_number: "5167XXXX8901", limit: 50000, balance: 0, status: "used", imported_at: "2023-06-04" },
] as const

export const sampleUsers = [
  { id: 1, name: "Admin User", email: "admin@example.com", role: "super_admin", agency: "Agence Centrale", last_login: "2023-06-10 09:15" },
  { id: 2, name: "DG", email: "dg@example.com", role: "director", agency: "Agence Centrale", last_login: "2023-06-09 14:30" },
  { id: 3, name: "Comptable", email: "compta@example.com", role: "accounting", agency: "Agence Centrale", last_login: "2023-06-10 08:45" },
  { id: 4, name: "Caissier 1", email: "cashier1@example.com", role: "cashier", agency: "Agence Centrale", last_login: "2023-06-10 10:20" },
  { id: 5, name: "Caissier 2", email: "cashier2@example.com", role: "cashier", agency: "Agence Nord", last_login: "2023-06-09 16:45" },
  { id: 6, name: "Auditeur", email: "audit@example.com", role: "auditor", agency: "Agence Centrale", last_login: "2023-06-08 11:30" },
  { id: 7, name: "Caissier 3", email: "cashier3@example.com", role: "cashier", agency: "Agence Sud", last_login: "2023-06-10 09:05" },
  { id: 8, name: "Délégué DG", email: "delegate@example.com", role: "delegate", agency: "Agence Centrale", last_login: "2023-06-09 15:20" },
  { id: 9, name: "Exécuteur", email: "executor@example.com", role: "executor", agency: "Agence Centrale", last_login: "2023-06-10 11:00" },
] as const

export const sampleAgencies = [
  { id: 1, name: "Agence Centrale", country: "Cameroun", address: "123 Avenue Centrale, Yaoundé", status: "active", users: 5 },
  { id: 2, name: "Agence Nord", country: "Cameroun", address: "456 Rue du Nord, Garoua", status: "active", users: 1 },
  { id: 3, name: "Agence Sud", country: "Cameroun", address: "789 Boulevard Sud, Douala", status: "active", users: 1 },
] as const

export const sampleExpenses = [
  { id: 1, title: "Achat matériel bureau", amount: 250000, priority: "high", created_by: "Caissier 1", status: "pending_accounting", date: "2023-06-10 09:15" },
  { id: 2, title: "Frais de déplacement", amount: 150000, priority: "medium", created_by: "Caissier 2", status: "pending_director", date: "2023-06-09 14:30" },
  { id: 3, title: "Maintenance équipement", amount: 350000, priority: "high", created_by: "Admin User", status: "approved", date: "2023-06-08 11:45" },
  { id: 4, title: "Formation personnel", amount: 500000, priority: "low", created_by: "Comptable", status: "rejected", date: "2023-06-07 16:20" },
  { id: 5, title: "Abonnement logiciel", amount: 200000, priority: "medium", created_by: "Caissier 3", status: "paid", date: "2023-06-06 10:05" },
] as const
