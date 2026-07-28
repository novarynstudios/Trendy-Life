import { ProductEditor } from "@/components/admin/product-editor"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string }> }) {
  await requireStaff("products.manage")
  const query = await searchParams
  const [categories, brands, warehouses, csrfToken] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.warehouse.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getCsrfToken(),
  ])
  return <ProductEditor categories={categories} brands={brands} warehouses={warehouses} csrfToken={csrfToken} tab={query.tab} error={query.error} />
}
