'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, ChevronDown, ChevronRight, Calendar, Pencil, Trash2, X, Loader2, AlertTriangle } from 'lucide-react'
import { projectsApi, clientsApi, usersApi, productsApi } from '@/lib/api'

const STATUS_CFG: Record<string,{label:string;color:string;dot:string}> = {
  nao_iniciado:{label:'Não iniciado',color:'bg-gray-100 text-gray-700 border-gray-200',dot:'bg-gray-400'},
  em_andamento:{label:'Em andamento',color:'bg-blue-50 text-blue-700 border-blue-200',dot:'bg-blue-500'},
  em_risco:{label:'Em risco',color:'bg-amber-50 text-amber-700 border-amber-200',dot:'bg-amber-500'},
  concluido:{label:'Concluído',color:'bg-green-50 text-green-700 border-green-200',dot:'bg-green-500'},
  pausado:{label:'Pausado',color:'bg-slate-100 text-slate-600 border-slate-200',dot:'bg-slate-400'},
}
const PRIORITY_CFG: Record<string,{label:string;color:string}> = {
  baixa:{label:'Baixa',color:'bg-slate-100 text-slate-600'},
  media:{label:'Média',color:'bg-blue-50 text-blue-700'},
  alta:{label:'Alta',color:'bg-orange-50 text-orange-700'},
  critica:{label:'Crítica',color:'bg-red-50 text-red-700'},
}
const BAR: Record<string,string> = {nao_iniciado:'bg-gray-400',em_andamento:'bg-blue-500',em_risco:'bg-amber-500',concluido:'bg-green-500',pausado:'bg-slate-400'}

function useFormData(initial?: any) {
  return useState({
    name: initial?.name||'', client_id: initial?.client_id||'', product_id: initial?.product_id||'',
    master_id: initial?.master_id||'', status: initial?.status||'nao_iniciado',
    priority: initial?.priority||'media', completion_pct: initial?.completion_pct??0,
    start_date: initial?.start_date||'', expected_end_date: initial?.expected_end_date||'',
    description: initial?.description||'', internal_notes: initial?.internal_notes||'',
  })
}

function Modal({ initial, onClose }: { initial?: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useFormData(initial)
  const { data: clients=[] } = useQuery({ queryKey:['clients'], queryFn: clientsApi.list })
  const { data: products=[] } = useQuery({ queryKey:['products'], queryFn: productsApi.list })
  const { data: users=[] } = useQuery({ queryKey:['users'], queryFn: usersApi.list })
  const implantadores = users.filter((u:any) => u.role !== 'admin' || true)

  const mut = useMutation({
    mutationFn: (d: any) => initial ? projectsApi.update(initial.id, d) : projectsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({queryKey:['projects']}); onClose() }
  })

  const set = (k: string, v: any) => setForm((f:any) => ({...f, [k]: v}))
  const valid = form.name && form.client_id && form.product_id && form.master_id && form.expected_end_date
  const inp = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-base font-semibold text-gray-900">{initial ? 'Editar projeto' : 'Novo projeto'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={16}/></button>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Nome do projeto *</label>
            <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Implantação ERP" className={inp}/>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Cliente *</label>
            <select value={form.client_id} onChange={e=>set('client_id',e.target.value)} className={inp}>
              <option value="">Selecione...</option>
              {clients.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {clients.length===0&&<p className="text-xs text-amber-600 mt-1">Cadastre clientes em Configurações.</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Produto *</label>
            <select value={form.product_id} onChange={e=>set('product_id',e.target.value)} className={inp}>
              <option value="">Selecione...</option>
              {products.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {products.length===0&&<p className="text-xs text-amber-600 mt-1">Cadastre produtos em Configurações.</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Implantador Master *</label>
            <select value={form.master_id} onChange={e=>set('master_id',e.target.value)} className={inp}>
              <option value="">Selecione...</option>
              {implantadores.map((u:any)=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
            <select value={form.status} onChange={e=>set('status',e.target.value)} className={inp}>
              {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Prioridade</label>
            <select value={form.priority} onChange={e=>set('priority',e.target.value)} className={inp}>
              {Object.entries(PRIORITY_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Conclusão: {form.completion_pct}%</label>
            <input type="range" min={0} max={100} value={form.completion_pct} onChange={e=>set('completion_pct',Number(e.target.value))} className="w-full"/>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Data de início</label>
            <input type="date" value={form.start_date} onChange={e=>set('start_date',e.target.value)} className={inp}/>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Previsão de entrega *</label>
            <input type="date" value={form.expected_end_date} onChange={e=>set('expected_end_date',e.target.value)} className={inp}/>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={2} className={inp+' resize-none'}/>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Observações internas</label>
            <textarea value={form.internal_notes} onChange={e=>set('internal_notes',e.target.value)} rows={2} className={inp+' resize-none'}/>
          </div>
        </div>
        {mut.isError && <p className="px-6 text-xs text-red-600">{(mut.error as any)?.response?.data?.detail || 'Erro ao salvar'}</p>}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={()=>mut.mutate(form)} disabled={!valid||mut.isPending}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2">
            {mut.isPending&&<Loader2 size={14} className="animate-spin"/>}
            {initial ? 'Salvar' : 'Criar projeto'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProjectRow({ p, clients, users }: { p: any; clients: any[]; users: any[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const qc = useQueryClient()
  const del = useMutation({ mutationFn: ()=>projectsApi.delete(p.id), onSuccess:()=>qc.invalidateQueries({queryKey:['projects']}) })
  const client = clients.find((c:any)=>c.id===p.client_id)
  const master = users.find((u:any)=>u.id===p.master_id)
  const cfg = STATUS_CFG[p.status]||STATUS_CFG.nao_iniciado
  const pcfg = PRIORITY_CFG[p.priority]||PRIORITY_CFG.media

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2 hover:border-gray-300 transition-colors">
        <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer" onClick={()=>setOpen(!open)}>
          <span className="text-gray-400 flex-shrink-0">{open?<ChevronDown size={15}/>:<ChevronRight size={15}/>}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 text-sm">{client?.name||'—'}</span>
              <span className="text-gray-400 text-xs">·</span>
              <span className="text-gray-600 text-sm truncate">{p.name}</span>
            </div>
            <span className="text-xs text-gray-400">{p.product_name||p.product||'—'}</span>
          </div>
          <span className="hidden sm:block text-xs text-gray-600 w-28 truncate">{master?.name||'—'}</span>
          <div className="hidden md:flex items-center gap-2 w-36">
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className={`h-full rounded-full ${BAR[p.status]||'bg-gray-400'}`} style={{width:`${p.completion_pct}%`}}/>
            </div>
            <span className="text-xs font-medium text-gray-700 w-8 text-right">{p.completion_pct}%</span>
          </div>
          <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{cfg.label}
          </span>
          <span className={`hidden lg:inline-flex px-2 py-0.5 rounded text-xs font-medium ${pcfg.color}`}>{pcfg.label}</span>
          <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
            <Calendar size={12}/><span>{p.expected_end_date}</span>
          </div>
          <div className="flex items-center gap-1 ml-1" onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setEditing(true)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={13}/></button>
            <button onClick={()=>del.mutate()} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13}/></button>
          </div>
        </div>
        {open && (
          <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-gray-500 mb-0.5">Master</p><p className="font-medium text-gray-800">{master?.name||'—'}</p></div>
              <div><p className="text-xs text-gray-500 mb-0.5">Início</p><p className="font-medium text-gray-800">{p.start_date||'—'}</p></div>
              <div><p className="text-xs text-gray-500 mb-0.5">Entrega</p><p className="font-medium text-gray-800">{p.expected_end_date}</p></div>
              <div><p className="text-xs text-gray-500 mb-0.5">Prioridade</p><p className="font-medium text-gray-800">{pcfg.label}</p></div>
            </div>
            {p.description&&<p className="text-sm text-gray-600 mt-3">{p.description}</p>}
            {p.internal_notes&&<p className="text-xs text-gray-400 italic mt-2">{p.internal_notes}</p>}
          </div>
        )}
      </div>
      {editing && <Modal initial={p} onClose={()=>setEditing(false)}/>}
    </>
  )
}

export default function Dashboard() {
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('')
  const [showModal, setShowModal] = useState(false)
  const { data, isLoading } = useQuery({ queryKey:['projects',search,statusF], queryFn:()=>projectsApi.list({search,status:statusF||undefined}) })
  const { data: clients=[] } = useQuery({ queryKey:['clients'], queryFn: clientsApi.list })
  const { data: users=[] } = useQuery({ queryKey:['users'], queryFn: usersApi.list })
  const projects = data?.items || []

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Projetos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} projeto{data?.total!==1?'s':''}</p>
        </div>
        <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Plus size={15}/>Novo projeto
        </button>
      </div>
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar projeto ou cliente..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"/>
        </div>
        <select value={statusF} onChange={e=>setStatusF(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {Object.entries(STATUS_CFG).map(([s,cfg])=>(
          <button key={s} onClick={()=>setStatusF(statusF===s?'':s)}
            className={`text-left p-3 rounded-xl border transition-all ${statusF===s?'border-blue-300 bg-blue-50':'border-gray-100 bg-white hover:border-gray-200'}`}>
            <div className="flex items-center gap-1.5 mb-1"><span className={`w-2 h-2 rounded-full ${cfg.dot}`}/><span className="text-xs text-gray-500">{cfg.label}</span></div>
            <span className="text-lg font-semibold text-gray-800">{projects.filter((p:any)=>p.status===s).length}</span>
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500"/></div>
      ) : projects.length===0 ? (
        <div className="text-center py-20 text-gray-400">
          <AlertTriangle size={32} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm font-medium">Nenhum projeto encontrado</p>
          <p className="text-xs mt-1">Clique em "Novo projeto" para começar</p>
        </div>
      ) : (
        <div>{projects.map((p:any)=><ProjectRow key={p.id} p={p} clients={clients} users={users}/>)}</div>
      )}
      {showModal && <Modal onClose={()=>setShowModal(false)}/>}
    </div>
  )
}
