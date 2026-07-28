import { notFound } from "next/navigation"
import { ProductEditor } from "@/components/admin/product-editor"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; error?: string; saved?: string }> }) {
  await requireStaff("products.view")
  const { id } = await params
  const query = await searchParams
  const [product, categories, brands, warehouses, csrfToken] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { images: { orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" }, include: { inventoryItems: true } } } }),
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.warehouse.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getCsrfToken(),
  ])
  if (!product) notFound()
  return <ProductEditor product={product} categories={categories} brands={brands} warehouses={warehouses} csrfToken={csrfToken} tab={query.tab} error={query.error} saved={query.saved} />
}
