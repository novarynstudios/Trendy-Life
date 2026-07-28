import Image from "next/image"
import Link from "next/link"
import { Archive, ArrowLeft, Save } from "lucide-react"
import { archiveProductAction, saveProductAction } from "@/app/actions"
import type { Category, Product } from "@/lib/types"

export function ProductForm({ product, categories, error }: { product?: Product | null; categories: Category[]; error?: string }) {
  return (
    <form action={saveProductAction}>
      <input type="hidden" name="id" value={product?.id || ""} />
      <div className="admin-page-head">
        <div><Link className="admin-back" href="/admin/products"><ArrowLeft size={15} /> Products</Link><h1>{product ? `Edit ${product.name}` : "Add a product"}</h1><p>{product ? "Update product information, pricing and stock." : "Create a new item and choose when it becomes visible."}</p></div>
        <div className="admin-head-actions"><Link className="admin-button secondary" href="/admin/products">Cancel</Link><button className="admin-button primary" type="submit"><Save size={16} /> Save product</button></div>
      </div>
      {error && <div className="admin-alert danger">Please complete every required product field.</div>}
      <div className="admin-form-layout">
        <div className="admin-form-main">
          <section className="admin-card form-card">
            <div className="admin-card-head"><div><h2>Basic information</h2><p>What customers will see on the product page.</p></div></div>
            <label><span>Product name *</span><input name="name" defaultValue={product?.name} required /></label>
            <div className="admin-form-grid two">
              <label><span>URL slug</span><input name="slug" defaultValue={product?.slug} placeholder="Created from product name" /></label>
              <label><span>Category *</span><select name="category" defaultValue={product?.category || ""} required><option value="" disabled>Select category</option>{categories.map((category) => <option key={category.id}>{category.name}</option>)}</select></label>
            </div>
            <label><span>Description *</span><textarea name="description" rows={7} defaultValue={product?.description} required /><small>Use plain, helpful language. This appears prominently on the product page.</small></label>
          </section>
          <section className="admin-card form-card">
            <div className="admin-card-head"><div><h2>Media</h2><p>Use an uploaded asset path or a full image URL. The first image is used across the catalog.</p></div></div>
            <label><span>Primary image path *</span><input name="image" defaultValue={product?.image} required /></label>
            <label><span>Secondary image path</span><input name="secondImage" defaultValue={product?.secondImage} /></label>
            {product?.image && <div className="admin-image-preview"><Image src={product.image} alt="Current product image" fill sizes="240px" /></div>}
          </section>
        </div>
        <aside className="admin-form-side">
          <section className="admin-card form-card">
            <h2>Publishing</h2>
            <label><span>Status</span><select name="status" defaultValue={product?.status || "draft"}><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
            <label className="admin-checkbox"><input name="featured" type="checkbox" defaultChecked={product?.featured} /><span><strong>Feature on homepage</strong><small>Show in the highlighted collection</small></span></label>
            <label><span>Badge</span><input name="badge" defaultValue={product?.badge || ""} placeholder="e.g. New or Best seller" /></label>
          </section>
          <section className="admin-card form-card">
            <h2>Pricing & stock</h2>
            <div className="admin-form-grid two">
              <label><span>Price (৳) *</span><input name="price" type="number" min="0" defaultValue={product?.price} required /></label>
              <label><span>Compare price</span><input name="comparePrice" type="number" min="0" defaultValue={product?.comparePrice || ""} /></label>
            </div>
            <label><span>SKU *</span><input name="sku" defaultValue={product?.sku} required /></label>
            <label><span>Inventory *</span><input name="inventory" type="number" min="0" defaultValue={product?.inventory ?? 0} required /></label>
          </section>
          {product && <section className="admin-card danger-zone"><h2>Archive product</h2><p>Removes this item from the public store without deleting order history.</p><button formAction={archiveProductAction} name="id" value={product.id} className="admin-button danger" type="submit"><Archive size={16} /> Archive</button></section>}
        </aside>
      </div>
    </form>
  )
}
