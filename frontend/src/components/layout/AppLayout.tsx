'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Calendar, BarChart3, Bell, Settings,
  ChevronLeft, ChevronRight, LogOut, Briefcase
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Projetos' },
  { href: '/schedule', icon: Calendar, label: 'Agenda Semanal' },
  { href: '/executive', icon: BarChart3, label: 'Executivo' },
  { href: '/settings', icon: Settings, label: 'Configurações' },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col bg-white border-r border-gray-200 transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}>
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-2.5 px-4 py-4 border-b border-gray-100',
          collapsed && 'justify-center'
        )}>
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Briefcase size={14} className="text-white" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-gray-800 truncate">
              Implantação
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  collapsed && 'justify-center px-2',
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={17} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">
            {NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.label || 'Plataforma'}
          </h2>
          <div className="flex items-center gap-2">
            <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell size={17} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-medium">
              JD
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
