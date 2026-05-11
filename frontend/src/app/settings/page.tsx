'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Loader2, Building2, UserCheck, Package } from 'lucide-react'
import { clientsApi, productsApi, usersApi } from '@/lib/api'

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
        <span className="text-gray-500">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function ClientsSection() {
  const qc = useQueryClient()
  const { data: clients=[], isLoading } = useQuery({ queryKey:['clients'], queryFn: clientsApi.list })
  const [form, setForm] = useState({ name:'', contact_name:'', contact_email:'' })
  const add = useMutation({ mutationFn: ()=>clientsApi.create(form), onSuccess:()=>{ qc.invalidateQueries({queryKey:['clients']}); setForm({name:'',contact_name:'',contact_email:''}) } })
  const del = useMutation({ mutationFn: (id:string)=>clientsApi.delete(id), onSuccess:()=>qc.invalidateQueries({queryKey:['clients']}) })
  const inp = "flex-1 min-w-[140px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
  return (
    <Section title="Clientes" icon={<Building2 size={18}/>}>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nome do cliente *" className={inp}/>
        <input value={form.contact_name} onChange={e=>setForm(f=>({...f,contact_name:e.target.value}))} placeholder="Contato" className={inp}/>
        <input value={form.contact_email} onChange={e=>setForm(f=>({...f,contact_email:e.target.value}))} placeholder="E-mail" className={inp}/>
        <button onClick={()=>add.mutate()} disabled={!form.name.trim()||add.isPending} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40">
          {add.isPending?<Loader2 size={14} className="animate-spin"/>:<Plus size={15}/>}Adicionar
        </button>
      </div>
      {isLoading ? <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-blue-500"/></div>
        : clients.length===0 ? <p className="text-sm text-gray-400 text-center py-4">Nenhum cliente cadastrado.</p>
        : <div className="space-y-2">{(clients as any[]).map(c=>(
          <div key={c.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg">
            <div><p className="text-sm font-medium text-gray-800">{c.name}</p>
              {(c.contact_name||c.contact_email)&&<p className="text-xs text-gray-500">{[c.contact_name,c.contact_email].filter(Boolean).join(' · ')}</p>}
            </div>
            <button onClick={()=>del.mutate(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
          </div>
        ))}</div>}
    </Section>
  )
}

function ProductsSection() {
  const qc = useQueryClient()
  const { data: products=[], isLoading } = useQuery({ queryKey:['products'], queryFn: productsApi.list })
  const [form, setForm] = useState({ name:'', description:'' })
  const add = useMutation({ mutationFn: ()=>productsApi.create(form), onSuccess:()=>{ qc.invalidateQueries({queryKey:['products']}); setForm({name:'',description:''}) } })
  const del = useMutation({ mutationFn: (id:string)=>productsApi.delete(id), onSuccess:()=>qc.invalidateQueries({queryKey:['products']}) })
  const inp = "flex-1 min-w-[140px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
  return (
    <Section title="Produtos" icon={<Package size={18}/>}>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nome do produto *" className={inp}/>
        <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Descrição" className={inp}/>
        <button onClick={()=>add.mutate()} disabled={!form.name.trim()||add.isPending} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40">
          {add.isPending?<Loader2 size={14} className="animate-spin"/>:<Plus size={15}/>}Adicionar
        </button>
      </div>
      {isLoading ? <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-blue-500"/></div>
        : products.length===0 ? <p className="text-sm text-gray-400 text-center py-4">Nenhum produto cadastrado.</p>
        : <div className="space-y-2">{(products as any[]).map(p=>(
          <div key={p.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg">
            <div><p className="text-sm font-medium text-gray-800">{p.name}</p>{p.description&&<p className="text-xs text-gray-500">{p.description}</p>}</div>
            <button onClick={()=>del.mutate(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
          </div>
        ))}</div>}
    </Section>
  )
}

function UsersSection() {
  const qc = useQueryClient()
  const { data: users=[], isLoading } = useQuery({ queryKey:['users'], queryFn: usersApi.list })
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'implantador', weekly_capacity_hours:40 })
  const [err, setErr] = useState('')
  const add = useMutation({
    mutationFn: ()=>usersApi.create(form),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['users']}); setForm({name:'',email:'',password:'',role:'implantador',weekly_capacity_hours:40}); setErr('') },
    onError:(e:any)=>setErr(e?.response?.data?.detail||'Erro ao criar usuário')
  })
  const del = useMutation({ mutationFn: (id:string)=>usersApi.delete(id), onSuccess:()=>qc.invalidateQueries({queryKey:['users']}) })
  const ROLES: Record<string,string> = {admin:'Administrador',gestor:'Gestor',implantador:'Implantador'}
  const ROLE_COLORS: Record<string,string> = {admin:'bg-red-50 text-red-700',gestor:'bg-purple-50 text-purple-700',implantador:'bg-blue-50 text-blue-700'}
  const getInitials = (n:string) => n.split(' ').slice(0,2).map((x:string)=>x[0]).join('').toUpperCase()
  const inp = "px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
  return (
    <Section title="Usuários e Implantadores" icon={<UserCheck size={18}/>}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
        <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nome completo *" className={inp}/>
        <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="E-mail *" className={inp}/>
        <input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Senha *" className={inp}/>
        <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} className={inp}>
          <option value="implantador">Implantador</option>
          <option value="gestor">Gestor</option>
          <option value="admin">Administrador</option>
        </select>
        <input type="number" value={form.weekly_capacity_hours} onChange={e=>setForm(f=>({...f,weekly_capacity_hours:Number(e.target.value)}))} placeholder="Horas/semana" className={inp}/>
        <button onClick={()=>add.mutate()} disabled={!form.name||!form.email||!form.password||add.isPending}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40">
          {add.isPending?<Loader2 size={14} className="animate-spin"/>:<Plus size={15}/>}Adicionar
        </button>
      </div>
      {err&&<p className="text-xs text-red-600 mb-3">{err}</p>}
      {isLoading ? <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-blue-500"/></div>
        : users.length===0 ? <p className="text-sm text-gray-400 text-center py-4">Nenhum usuário cadastrado.</p>
        : <div className="space-y-2 mt-4">{(users as any[]).map(u=>(
          <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">{getInitials(u.name)}</div>
            <div className="flex-1"><p className="text-sm font-medium text-gray-800">{u.name}</p><p className="text-xs text-gray-500">{u.email}</p></div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]||'bg-gray-100 text-gray-600'}`}>{ROLES[u.role]||u.role}</span>
            <button onClick={()=>del.mutate(u.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
          </div>
        ))}</div>}
    </Section>
  )
}

export default function Settings() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gerencie clientes, produtos e usuários da plataforma</p>
      </div>
      <ClientsSection/>
      <ProductsSection/>
      <UsersSection/>
    </div>
  )
}
