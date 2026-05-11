'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Eye, EyeOff, Loader2 } from 'lucide-react'
import { authApi } from '@/lib/api'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const data = await authApi.login(email, password)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      router.push('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Credenciais inválidas')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center"><Briefcase size={20} className="text-white"/></div>
          <div><p className="font-semibold text-gray-900">Implantação Platform</p><p className="text-xs text-gray-400">Gestão de projetos e equipes</p></div>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Bem-vindo de volta</h1>
        <p className="text-sm text-gray-500 mb-6">Faça login para continuar</p>
        {error&&<div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">E-mail</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="seu@email.com"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"/>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Senha</label>
            <div className="relative">
              <input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 pr-10"/>
              <button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {show?<EyeOff size={16}/>:<Eye size={16}/>}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading&&<Loader2 size={16} className="animate-spin"/>}{loading?'Entrando...':'Entrar'}
          </button>
        </form>
        <p className="text-xs text-gray-400 text-center mt-6">Acesso restrito. Solicite seu cadastro ao administrador.</p>
      </div>
    </div>
  )
}
