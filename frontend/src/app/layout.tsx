'use client'
import './globals.css'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Providers } from '@/components/Providers'
import { LayoutDashboard, Calendar, BarChart3, Settings, ChevronLeft, ChevronRight, Briefcase, Bell, LogOut } from 'lucide-react'

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Projetos' },
  { href: '/schedule',  icon: Calendar,         label: 'Agenda Semanal' },
  { href: '/executive', icon: BarChart3,         label: 'Executivo' },
  { href: '/settings',  icon: Settings,          label: 'Configurações' },
]
const PUBLIC = ['/login']

function getInitials(name: string) {
  return name?.split(' ').slice(0,2).map((n:string)=>n[0]).join('').toUpperCase()||'U'
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    else router.push('/login')
  }, [])

  const logout = () => { localStorage.clear(); router.push('/login') }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ${collapsed?'w-16':'w-56'} flex-shrink-0`}>
        <div className={`flex items-center gap-2.5 px-4 py-4 border-b border-gray-100 ${collapsed?'justify-center':''}`}>
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0"><Briefcase size={16} className="text-white"/></div>
          {!collapsed&&<div><p className="text-sm font-semibold text-gray-800 leading-tight">Implantação</p><p className="text-xs text-gray-400">Platform</p></div>}
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV.map(item=>{
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} title={collapsed?item.label:undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${collapsed?'justify-center':''} ${active?'bg-blue-50 text-blue-700 font-medium':'text-gray-600 hover:bg-gray-100'}`}>
                <item.icon size={18} className="flex-shrink-0"/>{!collapsed&&<span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-gray-100 p-2 space-y-1">
          {!collapsed&&user&&<div className="px-3 py-2"><p className="text-xs font-medium text-gray-700 truncate">{user.name}</p><p className="text-xs text-gray-400 capitalize">{user.role}</p></div>}
          <button onClick={logout} title="Sair" className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors ${collapsed?'justify-center':''}`}>
            <LogOut size={16}/>{!collapsed&&<span>Sair</span>}
          </button>
          <button onClick={()=>setCollapsed(!collapsed)} className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            {collapsed?<ChevronRight size={16}/>:<ChevronLeft size={16}/>}
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-medium text-gray-700">{NAV.find(n=>pathname.startsWith(n.href))?.label||'Plataforma'}</h2>
          <div className="flex items-center gap-2">
            <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><Bell size={17}/><span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"/></button>
            {user&&<div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-semibold">{getInitials(user.name)}</div>}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublic = PUBLIC.some(p=>pathname.startsWith(p))
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900">
        <Providers>
          {isPublic ? children : <AppShell>{children}</AppShell>}
        </Providers>
      </body>
    </html>
  )
}
