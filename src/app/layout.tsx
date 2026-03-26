import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IN$JAM - I Never $ Joke About Money',
  description: 'IN$JAM trading workspace and market analysis dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
