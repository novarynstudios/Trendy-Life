export type ProductStatus = "active" | "draft" | "archived"

export type Product = {
  id: number
  slug: string
  name: string
  category: string
  description: string
  price: number
  comparePrice: number | null
  sku: string
  inventory: number
  status: ProductStatus
  featured: boolean
  badge: string | null
  image: string
  secondImage: string
  createdAt: string
  updatedAt: string
}

export type Category = {
  id: number
  slug: string
  name: string
  note: string
  image: string
  active: boolean
}

export type CartItem = {
  product: Product
  quantity: number
}

export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"

export type Order = {
  id: number
  userId: number | null
  orderNumber: string
  customerName: string
  email: string
  phone: string
  address: string
  city: string
  paymentMethod: string
  subtotal: number
  shipping: number
  discountCode: string | null
  discountAmount: number
  total: number
  status: OrderStatus
  paymentStatus: string
  paymentGateway: string
  paymentInvoiceId: string | null
  paymentTransactionId: string | null
  notes: string
  createdAt: string
}

export type Customer = {
  id: number
  name: string
  email: string
  phone: string
  company: string
  address: string
  city: string
  createdAt: string
}

export type Campaign = {
  id: number
  name: string
  code: string
  title: string
  description: string
  discountType: "percentage" | "fixed"
  discountValue: number
  minOrder: number
  startsAt: string
  endsAt: string
  active: boolean
  popupEnabled: boolean
  popupTitle: string
  popupCopy: string
  popupCta: string
  popupImage: string
}

export type SupportTicket = {
  id: number
  ticketNumber: string
  userId: number
  customerName: string
  email: string
  subject: string
  department: string
  priority: string
  status: string
  message: string
  createdAt: string
  updatedAt: string
}

export type PaymentAttempt = {
  id: number
  orderId: number
  orderNumber: string
  gateway: string
  invoiceId: string | null
  amount: number
  status: string
  paymentMethod: string
  transactionId: string | null
  createdAt: string
  updatedAt: string
}

export type OrderItem = {
  id: number
  productId: number | null
  name: string
  sku: string
  price: number
  quantity: number
  image: string
}

export type SiteSettings = {
  storeName: string
  supportEmail: string
  supportPhone: string
  address: string
  announcement: string
  heroEyebrow: string
  heroTitle: string
  heroAccent: string
  heroDescription: string
  heroImage: string
  shippingThreshold: number
  flatShipping: number
  currency: string
}
