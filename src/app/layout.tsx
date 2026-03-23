import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MKTS — Market Terminal',
  description: 'Real-time stock market analysis terminal',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}