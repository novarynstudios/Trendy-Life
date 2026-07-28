"use client"

import { useEffect } from "react"
import { useCart } from "@/components/cart-provider"

export function ClearCart() {
  const { clearCart } = useCart()
  useEffect(() => clearCart(), [clearCart])
  return null
}
