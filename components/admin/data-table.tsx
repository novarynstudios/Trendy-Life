"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  type ColumnDef, type SortingState, flexRender, getCoreRowModel, useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, ChevronLeft, ChevronRight, Columns3, Download, MoreHorizontal } from "lucide-react"

export type AdminTableValue = string | number | boolean | null
export type AdminTableRow = { id: string } & Record<string, AdminTableValue>
export type AdminColumnSpec = {
  key: string
  label: string
  type?: "text" | "number" | "money" | "date" | "status" | "primary"
  hideOnMobile?: boolean
}

function renderValue(value: AdminTableValue, type: AdminColumnSpec["type"]) {
  if (value === null || value === "") return <span className="tl-muted">—</span>
  if (type === "money") return <strong>৳{Number(value).toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
  if (type === "date") return new Intl.DateTimeFormat("en-BD", { dateStyle: "medium" }).format(new Date(String(value)))
  if (type === "status") {
    const label = String(value).replaceAll("_", " ").toLocaleLowerCase()
    return <span className={`tl-status ${label.replaceAll(" ", "-")}`}>{label}</span>
  }
  if (type === "primary") return <strong className="tl-table-primary">{String(value)}</strong>
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}

export function AdminDataTable({
  columns: columnSpecs,
  rows,
  total,
  page,
  pageSize,
  actionBase,
  exportHref,
  bulkAction,
  bulkOptions = [],
  csrfToken,
}: {
  columns: AdminColumnSpec[]
  rows: AdminTableRow[]
  total: number
  page: number
  pageSize: number
  actionBase?: string
  exportHref?: string
  bulkAction?: (formData: FormData) => void | Promise<void>
  bulkOptions?: { value: string; label: string }[]
  csrfToken?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [sorting, setSorting] = useState<SortingState>(() => {
    const sort = searchParams.get("sort")
    return sort ? [{ id: sort, desc: searchParams.get("direction") === "desc" }] : []
  })
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})

  const columns = useMemo<ColumnDef<AdminTableRow>[]>(() => [
    {
      id: "select",
      header: ({ table }) => <input type="checkbox" aria-label="Select all rows on this page" checked={table.getIsAllPageRowsSelected()} onChange={table.getToggleAllPageRowsSelectedHandler()} />,
      cell: ({ row }) => <input type="checkbox" aria-label={`Select row ${row.original.id}`} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />,
      enableSorting: false,
    },
    ...columnSpecs.map<ColumnDef<AdminTableRow>>((column) => ({
      id: column.key,
      accessorKey: column.key,
      header: column.label,
      cell: ({ row }) => actionBase && column.type === "primary"
        ? <Link href={`${actionBase}/${row.original.id}`}>{renderValue(row.original[column.key], column.type)}</Link>
        : renderValue(row.original[column.key], column.type),
      meta: { className: `${column.type === "number" || column.type === "money" ? "numeric" : ""} ${column.hideOnMobile ? "tl-cell-secondary" : ""}` },
    })),
    ...(actionBase ? [{
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }: { row: { original: AdminTableRow } }) => <Link className="tl-table-action" href={`${actionBase}/${row.original.id}`}>Open <MoreHorizontal size={13} /></Link>,
    } satisfies ColumnDef<AdminTableRow>] : []),
  ], [actionBase, columnSpecs])

  // TanStack Table intentionally exposes stateful callback APIs; this component owns that state.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, rowSelection, columnVisibility },
    manualSorting: true,
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    enableRowSelection: true,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater
      setSorting(next)
      const params = new URLSearchParams(searchParams.toString())
      if (next[0]) {
        params.set("sort", next[0].id)
        params.set("direction", next[0].desc ? "desc" : "asc")
      } else {
        params.delete("sort")
        params.delete("direction")
      }
      params.set("page", "1")
      router.push(`${pathname}?${params.toString()}`)
    },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  })

  const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  function pageHref(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(nextPage))
    return `${pathname}?${params.toString()}`
  }

  return (
    <div className="tl-table-component">
      <div className="tl-table-options">
        <span><strong>{total.toLocaleString("en-BD")}</strong> records</span>
        <div>
          <details className="tl-column-menu">
            <summary className="tl-button"><Columns3 size={14} />Columns <ChevronDown size={13} /></summary>
            <div>{table.getAllLeafColumns().filter((column) => !["select", "actions"].includes(column.id)).map((column) => <label key={column.id}><input type="checkbox" checked={column.getIsVisible()} onChange={column.getToggleVisibilityHandler()} />{columnSpecs.find((spec) => spec.key === column.id)?.label ?? column.id}</label>)}</div>
          </details>
          {exportHref && <Link className="tl-button" href={exportHref}><Download size={14} />Export CSV</Link>}
        </div>
      </div>
      {bulkAction && bulkOptions.length > 0 && <form className="tl-bulk-bar" action={bulkAction}>
        {csrfToken && <input type="hidden" name="_csrf" value={csrfToken} />}
        {selectedIds.map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
        <strong>{selectedIds.length} selected</strong>
        <label><span className="sr-only">Bulk action</span><select name="bulkAction" disabled={!selectedIds.length} defaultValue=""><option value="" disabled>Choose bulk action</option>{bulkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <button className="tl-button" type="submit" disabled={!selectedIds.length}>Apply</button>
      </form>}
      <div className="tl-table-scroll">
        <table className="tl-data-table">
          <thead>{table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}>{headerGroup.headers.map((header) => {
            const sorted = header.column.getIsSorted()
            return <th key={header.id} className={(header.column.columnDef.meta as { className?: string } | undefined)?.className} aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}>
              {header.isPlaceholder ? null : header.column.getCanSort() ? <button type="button" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<span aria-hidden>{sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"}</span></button> : flexRender(header.column.columnDef.header, header.getContext())}
            </th>
          })}</tr>)}</thead>
          <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} data-selected={row.getIsSelected() || undefined}>{row.getVisibleCells().map((cell) => <td key={cell.id} className={(cell.column.columnDef.meta as { className?: string } | undefined)?.className}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={columns.length}><div className="tl-table-empty"><strong>No records found</strong><span>Change the filters or create the first record.</span></div></td></tr>}</tbody>
        </table>
      </div>
      <footer className="tl-table-pagination">
        <span>Showing {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total}</span>
        <nav aria-label="Table pagination">
          <Link className={page <= 1 ? "is-disabled" : ""} href={pageHref(Math.max(1, page - 1))} aria-disabled={page <= 1}><ChevronLeft size={15} />Previous</Link>
          <span>Page {page} of {pageCount}</span>
          <Link className={page >= pageCount ? "is-disabled" : ""} href={pageHref(Math.min(pageCount, page + 1))} aria-disabled={page >= pageCount}>Next<ChevronRight size={15} /></Link>
        </nav>
      </footer>
    </div>
  )
}
