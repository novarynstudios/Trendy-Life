"use client"

import { useMemo, useState } from "react"
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Download } from "lucide-react"
import { money } from "@/lib/format"

type RevenuePoint = {
  date: string
  gross: number
  net: number
  refunds: number
  discounts: number
  taxes: number
  shipping: number
}

const periods = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "month", label: "This month", days: 0 },
  { key: "last-month", label: "Last month", days: 0 },
  { key: "year", label: "This year", days: 0 },
  { key: "custom", label: "Custom range", days: 0 },
] as const

const series = [
  { key: "gross", label: "Gross revenue", color: "#1769c2" },
  { key: "net", label: "Net revenue", color: "#17834f" },
  { key: "refunds", label: "Refunds", color: "#bd2d36" },
  { key: "discounts", label: "Discounts", color: "#a85a0b" },
  { key: "taxes", label: "Taxes", color: "#7654b5" },
  { key: "shipping", label: "Shipping income", color: "#287d8e" },
] as const

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const [period, setPeriod] = useState<(typeof periods)[number]["key"]>("30d")
  const [start, setStart] = useState(data.at(-30)?.date ?? data[0]?.date ?? "")
  const [end, setEnd] = useState(data.at(-1)?.date ?? "")
  const [visible, setVisible] = useState<Set<string>>(new Set(["gross", "net", "refunds"]))

  const filtered = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (period === "custom") return data.filter((point) => (!start || point.date >= start) && (!end || point.date <= end))
    if (period === "month") {
      const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      return data.filter((point) => point.date.startsWith(prefix))
    }
    if (period === "last-month") {
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prefix = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`
      return data.filter((point) => point.date.startsWith(prefix))
    }
    if (period === "year") return data.filter((point) => point.date.startsWith(String(now.getFullYear())))
    const days = periods.find((item) => item.key === period)?.days ?? 30
    const cutoff = new Date(today.getTime() - Math.max(0, days - 1) * 86_400_000).toISOString().slice(0, 10)
    return data.filter((point) => point.date >= cutoff)
  }, [data, end, period, start])

  const totals = useMemo(() => Object.fromEntries(series.map(({ key }) => [key, filtered.reduce((sum, point) => sum + point[key], 0)])), [filtered])

  function exportCsv() {
    const header = ["date", ...series.map((item) => item.key)].join(",")
    const rows = filtered.map((point) => [point.date, ...series.map((item) => point[item.key])].join(","))
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `trendy-life-revenue-${period}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="tl-card tl-revenue-card">
      <div className="tl-card-header">
        <div><h2>Revenue performance</h2><p>Paid transactions, refunds, discounts, taxes, and shipping income</p></div>
        <button className="tl-button" type="button" onClick={exportCsv}><Download size={14} />CSV</button>
      </div>
      <div className="tl-chart-toolbar">
        <div className="tl-segmented" role="group" aria-label="Revenue period">
          {periods.map((item) => <button key={item.key} type="button" className={period === item.key ? "is-active" : ""} onClick={() => setPeriod(item.key)}>{item.label}</button>)}
        </div>
        {period === "custom" && <div className="tl-date-range"><label>From <input type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)} /></label><label>To <input type="date" value={end} min={start} onChange={(event) => setEnd(event.target.value)} /></label></div>}
      </div>
      <div className="tl-chart-totals">
        {series.map((item) => (
          <button key={item.key} type="button" className={visible.has(item.key) ? "is-visible" : ""} onClick={() => setVisible((current) => {
            const next = new Set(current)
            if (next.has(item.key)) next.delete(item.key)
            else next.add(item.key)
            return next
          })}>
            <span style={{ background: item.color }} />
            <small>{item.label}</small>
            <strong>{money(totals[item.key] ?? 0)}</strong>
          </button>
        ))}
      </div>
      <div className="tl-chart" role="img" aria-label={`Revenue chart with ${filtered.length} daily data points`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filtered} margin={{ top: 10, right: 15, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="#e1e6ec" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#697688" }} tickLine={false} axisLine={{ stroke: "#ccd4de" }} minTickGap={34} />
            <YAxis tick={{ fontSize: 10, fill: "#697688" }} tickLine={false} axisLine={false} width={68} tickFormatter={(value: number) => `৳${Intl.NumberFormat("en", { notation: "compact" }).format(value)}`} />
            <Tooltip formatter={(value) => money(Number(value))} labelFormatter={(label) => new Intl.DateTimeFormat("en-BD", { dateStyle: "medium" }).format(new Date(String(label)))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.filter((item) => visible.has(item.key)).map((item) => <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">Gross revenue for this period is {money(totals.gross ?? 0)}. Net revenue is {money(totals.net ?? 0)}. Refunds are {money(totals.refunds ?? 0)}.</p>
    </section>
  )
}
