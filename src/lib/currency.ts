export const CURRENCIES = [
  { code: "USD", label: "USD ($)" },
  { code: "CAD", label: "CAD (CA$)" },
  { code: "GBP", label: "GBP (£)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "AUD", label: "AUD (A$)" },
  { code: "NZD", label: "NZD (NZ$)" },
  { code: "CHF", label: "CHF (Fr)" },
  { code: "JPY", label: "JPY (¥)" },
  { code: "SEK", label: "SEK (kr)" },
  { code: "DKK", label: "DKK (kr)" },
  { code: "NOK", label: "NOK (kr)" },
  { code: "SGD", label: "SGD (S$)" },
  { code: "HKD", label: "HKD (HK$)" },
  { code: "ZAR", label: "ZAR (R)" },
  { code: "INR", label: "INR (₹)" },
  { code: "BRL", label: "BRL (R$)" },
  { code: "MXN", label: "MXN (MX$)" },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]["code"]

export const formatPrice = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount)

export const currencySymbol = (currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? "$"
