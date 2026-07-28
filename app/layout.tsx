import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Trendy Life — Office Furniture & Interior Solutions",
    template: "%s · Trendy Life",
  },
  description: "Office desks, seating, workstations, storage and interior solutions for modern workplaces across Bangladesh.",
}

export const viewport: Viewport = {
  themeColor: "#f4f2ee",
  colorScheme: "light"
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
