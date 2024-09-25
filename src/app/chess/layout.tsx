'use client'

import { cn } from "@/lib/utils"
import './chess-layout.css'

export default function ChessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={cn(
      "fixed inset-0 bg-background font-sans antialiased overflow-auto",
      "z-10" // Ensure it's above other content
    )}>
      <main className="flex flex-col min-h-screen w-full px-4 py-8 md:px-8 lg:px-16 xl:px-24">
        {children}
      </main>
    </div>
  )
}