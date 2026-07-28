import "server-only"

export type PageQuery = {
  page?: string
  pageSize?: string
  sort?: string
  direction?: string
  q?: string
}

export function parseDateFilter(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`)
  if (Number.isNaN(parsed.getTime())) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return undefined
  return parsed
}

export function parsePageQuery(query: PageQuery, allowedSorts: readonly string[], defaultSort = "createdAt") {
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1)
  const pageSize = [10, 25, 50, 100].includes(Number(query.pageSize)) ? Number(query.pageSize) : 25
  const sort = allowedSorts.includes(query.sort ?? "") ? String(query.sort) : defaultSort
  const direction = query.direction === "asc" ? "asc" as const : "desc" as const
  const q = (query.q ?? "").trim().slice(0, 150)
  return { page, pageSize, skip: (page - 1) * pageSize, sort, direction, q }
}
