export const money = (value: number) => `৳${Number(value).toLocaleString("en-BD")}`

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-BD", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-BD", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value))
