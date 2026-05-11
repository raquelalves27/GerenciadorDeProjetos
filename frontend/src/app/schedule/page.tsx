'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, ChevronLeft, ChevronRight, Copy, Loader2, User } from 'lucide-react'
import { format, addWeeks, subWeeks, startOfWeek, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { scheduleApi, usersApi, projectsApi, clientsApi } from '@/lib/api'

const SHIFTS = [
  { key:'manha', label:'Manhã', emoji:'🌅', bg:'bg-amber-50 border-amber-100', badge:'bg-amber-50 text-amber-700 border-amber-200' },
  { key:'tarde', label:'Tarde', emoji:'☀️', bg:'bg-orange-50 border-orange-100', badge:'bg-orange-50 text-orange-700 border-orange-200' },
]
const ACTIVITY_TYPES = [
  { label:'Implantação', value:'implantacao' },
  { label:'Treinamento', value:'treinamento' },
  { label:'Suporte',     value:'suporte' },
  { label:'Reunião',     value:'reuniao' },
  { label:'Configuração',value:'configuracao' },
]
const COLORS = ['bg-blue-100 text-blue-800 border-blue-200','bg-purple-100 text-purple-800 border-purple-200','bg-green-100 text-green-800 border-green-200','bg-rose-100 text-rose-800 border-rose-200','bg-teal-100 text-teal-800 border-teal-200','bg-orange-100 text-orange-800 border-orange-200']

function getInitials(name: string) { return name?.split(' ').slice(0,2).map((n:string)=>n[0]).join('').toUpperCase()||'?' }

function AddModal({ userId, shift, weekStart, onClose }: { userId:string; shift:any; weekStart:string; onClose:()=>void }) {
  const qc = useQueryClient()
  const { data: projectsData } = useQuery({ queryKey:['projects-all'], queryFn:()=>projectsApi.list({size:100}) })
  const { data: clients=[] } = useQuery({ queryKey:['clients'], queryFn: clientsApi.list })
  const [projectId, setProjectId] = useState('')
  const [actType, setActType] = useState('implantacao')
  const projects = projectsData?.items || []
  const add = useMutation({
    mutationFn: ()=>scheduleApi.create({ user_id:userId, project_id:projectId, week_start:weekStart, shift:shift.key, activity_type:actType }),
    onSuccess: ()=>{ qc.invalidateQueries({ queryKey:['schedule'] }); onClose() },
  })
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div><h3 className="text-sm font-semibold text-gray-900">Nova alocação</h3><p className="text-xs text-gray-500 mt-0.5">{shift.emoji} {shift.label} · semana de {weekStart}</p></div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={16}/></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Projeto</label>
            <select value={projectId} onChange={e=>setProjectId(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white">
              <option value="">Selecione um projeto...</option>
              {projects.map((p:any)=>{ const c=(clients as any[]).find((c:any)=>c.id===p.client_id); return <option key={p.id} value={p.id}>{c?.name||'—'} — {p.name}</option> })}
            </select>
            {projects.length===0&&<p className="text-xs text-amber-600 mt-1">Cadastre projetos no Dashboard primeiro.</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tipo de atividade</label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_TYPES.map(t=>(
                <button key={t.value} onClick={()=>setActType(t.value)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${actType===t.value?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{t.label}</button>
              ))}
            </div>
          </div>
        </div>
        {add.isError&&<p className="px-5 pb-2 text-xs text-red-600">Erro ao salvar. Tente novamente.</p>}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={()=>add.mutate()} disabled={!projectId||add.isPending} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2">
            {add.isPending&&<Loader2 size={14} className="animate-spin"/>}Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

function MonthView({ selectedUserId }: { selectedUserId:string }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const qc = useQueryClient()
  const { data: users=[] } = useQuery({ queryKey:['users'], queryFn: usersApi.list })
  const { data: clients=[] } = useQuery({ queryKey:['clients'], queryFn: clientsApi.list })
  const start = startOfMonth(currentMonth), end = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start, end })
  const weekStarts = [...new Set(days.map(d=>format(startOfWeek(d,{weekStartsOn:1}),'yyyy-MM-dd')))]
  const weekQueries = weekStarts.map(ws=>useQuery({ queryKey:['schedule',ws], queryFn:()=>scheduleApi.getWeek(ws) }))
  const del = useMutation({ mutationFn:(id:string)=>scheduleApi.delete(id), onSuccess:()=>qc.invalidateQueries({queryKey:['schedule']}) })

  const allByUserDateShift: Record<string,Record<string,Record<string,any[]>>> = {}
  weekQueries.forEach((q,qi)=>{
    if(!q.data) return
    Object.entries(q.data as Record<string,any>).forEach(([userId, shifts]:any)=>{
      if(!allByUserDateShift[userId]) allByUserDateShift[userId]={}
      const ws = weekStarts[qi]
      const weekDays = eachDayOfInterval({ start:new Date(ws+'T12:00:00'), end:addWeeks(new Date(ws+'T12:00:00'),1) }).slice(0,7)
      weekDays.forEach(day=>{
        if(!isSameMonth(day,currentMonth)) return
        const dk = format(day,'yyyy-MM-dd')
        if(!allByUserDateShift[userId][dk]) allByUserDateShift[userId][dk]={manha:[],tarde:[]}
        ;['manha','tarde'].forEach(sh=>{ if(shifts[sh]) allByUserDateShift[userId][dk][sh].push(...shifts[sh]) })
      })
    })
  })

  const filteredUsers = selectedUserId==='all' ? (users as any[]) : (users as any[]).filter((u:any)=>u.id===selectedUserId)
  const startDay = getDay(start)===0?6:getDay(start)-1
  const padded = [...Array(startDay).fill(null),...days]
  const WD = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
  const isLoading = weekQueries.some(q=>q.isLoading)

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <button onClick={()=>setCurrentMonth(m=>subMonths(m,1))} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><ChevronLeft size={18}/></button>
        <span className="text-sm font-medium text-gray-700 min-w-[150px] text-center capitalize">{format(currentMonth,'MMMM yyyy',{locale:ptBR})}</span>
        <button onClick={()=>setCurrentMonth(m=>addMonths(m,1))} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><ChevronRight size={18}/></button>
      </div>
      {isLoading ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500"/></div>
      : filteredUsers.length===0 ? <div className="text-center py-16 text-gray-400 text-sm">Nenhum implantador encontrado. Cadastre usuários em Configurações.</div>
      : <div className="space-y-6">
        {filteredUsers.map((user:any)=>(
          <div key={user.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-semibold">{getInitials(user.name)}</div>
              <div><p className="text-sm font-semibold text-gray-800">{user.name}</p><p className="text-xs text-gray-400 capitalize">{user.role}</p></div>
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-amber-600">🌅 Manhã</span>
                <span className="text-xs text-orange-600">☀️ Tarde</span>
              </div>
            </div>
            <div>
              <div className="grid grid-cols-7 border-b border-gray-100">
                {WD.map(d=><div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {padded.map((day,i)=>{
                  const dk = day?format(day,'yyyy-MM-dd'):null
                  const isToday = dk===format(new Date(),'yyyy-MM-dd')
                  const da = dk?(allByUserDateShift[user.id]?.[dk]||{manha:[],tarde:[]}):null
                  const mu = da?[...new Map(da.manha.map((a:any)=>[a.project_id,a])).values()]:[]
                  const tu = da?[...new Map(da.tarde.map((a:any)=>[a.project_id,a])).values()]:[]
                  return (
                    <div key={i} className={`min-h-[80px] p-1.5 border-r border-b border-gray-100 ${!day?'bg-gray-50/50':''}`}>
                      {day&&<>
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 ${isToday?'bg-blue-600 text-white':'text-gray-500'}`}>{format(day,'d')}</div>
                        <div className="space-y-0.5">
                          {mu.slice(0,2).map((a:any,ai:number)=>{ const p=a.project||{}; const c=(clients as any[]).find((c:any)=>c.id===p.client_id); return (
                            <div key={a.id+'-m'} className={`group flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${COLORS[ai%COLORS.length]}`}>
                              <span className="text-[9px]">🌅</span><span className="truncate">{c?.name||p.name||'?'}</span>
                              <button onClick={()=>del.mutate(a.id)} className="opacity-0 group-hover:opacity-100 ml-auto"><X size={9}/></button>
                            </div>
                          )})}
                          {tu.slice(0,2).map((a:any,ai:number)=>{ const p=a.project||{}; const c=(clients as any[]).find((c:any)=>c.id===p.client_id); return (
                            <div key={a.id+'-t'} className={`group flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${COLORS[(ai+3)%COLORS.length]}`}>
                              <span className="text-[9px]">☀️</span><span className="truncate">{c?.name||p.name||'?'}</span>
                              <button onClick={()=>del.mutate(a.id)} className="opacity-0 group-hover:opacity-100 ml-auto"><X size={9}/></button>
                            </div>
                          )})}
                        </div>
                      </>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  )
}

function WeekView({ weekStart, selectedUserId }: { weekStart:string; selectedUserId:string }) {
  const qc = useQueryClient()
  const { data: users=[] } = useQuery({ queryKey:['users'], queryFn: usersApi.list })
  const { data: schedule={}, isLoading } = useQuery({ queryKey:['schedule',weekStart], queryFn:()=>scheduleApi.getWeek(weekStart) })
  const { data: clients=[] } = useQuery({ queryKey:['clients'], queryFn: clientsApi.list })
  const [modal, setModal] = useState<{userId:string;shift:any}|null>(null)
  const del = useMutation({ mutationFn:(id:string)=>scheduleApi.delete(id), onSuccess:()=>qc.invalidateQueries({queryKey:['schedule',weekStart]}) })
  const prevWeek = format(subWeeks(new Date(weekStart+'T12:00:00'),1),'yyyy-MM-dd')
  const clone = useMutation({ mutationFn:()=>scheduleApi.cloneWeek({source_week:prevWeek,target_week:weekStart}), onSuccess:()=>qc.invalidateQueries({queryKey:['schedule',weekStart]}) })
  const filteredUsers = selectedUserId==='all'?(users as any[]):(users as any[]).filter((u:any)=>u.id===selectedUserId)
  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <button onClick={()=>clone.mutate()} disabled={clone.isPending} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
          {clone.isPending?<Loader2 size={14} className="animate-spin"/>:<Copy size={14}/>}Clonar semana anterior
        </button>
      </div>
      {isLoading?<div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500"/></div>:(
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-44">Implantador</th>
                {SHIFTS.map(s=><th key={s.key} className="text-left px-4 py-3"><span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${s.badge}`}>{s.emoji} {s.label}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length===0?<tr><td colSpan={3} className="text-center py-12 text-gray-400 text-sm">Nenhum implantador encontrado.</td></tr>
              :filteredUsers.map((user:any,idx:number)=>{
                const ua=(schedule as any)[user.id]||{}
                return (
                  <tr key={user.id} className={`border-t border-gray-100 ${idx%2===0?'':'bg-gray-50/50'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-semibold">{getInitials(user.name)}</div>
                        <span className="text-sm font-medium text-gray-800">{user.name}</span>
                      </div>
                    </td>
                    {SHIFTS.map(shift=>{
                      const items=ua[shift.key]||[]
                      return (
                        <td key={shift.key} className="px-3 py-3 align-top">
                          <div className={`min-h-[72px] rounded-xl p-2 border ${shift.bg} space-y-1.5`}>
                            {items.map((a:any,ai:number)=>{ const p=a.project||{}; const c=(clients as any[]).find((c:any)=>c.id===p.client_id); return (
                              <div key={a.id} className={`group flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs ${COLORS[ai%COLORS.length]}`}>
                                <div className="flex-1 min-w-0"><p className="font-semibold truncate">{c?.name||p.name||'?'}</p><p className="opacity-70 truncate capitalize">{a.activity_type}</p></div>
                                <button onClick={()=>del.mutate(a.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 rounded transition-all flex-shrink-0"><X size={11}/></button>
                              </div>
                            )})}
                            <button onClick={()=>setModal({userId:user.id,shift})} className="w-full flex items-center justify-center py-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/60 rounded-lg border border-dashed border-transparent hover:border-gray-300 text-xs gap-1 transition-colors">
                              <Plus size={13}/> Adicionar
                            </button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal&&<AddModal userId={modal.userId} shift={modal.shift} weekStart={weekStart} onClose={()=>setModal(null)}/>}
    </div>
  )
}

export default function SchedulePage() {
  const [view, setView] = useState<'week'|'month'>('month')
  const [currentWeek, setCurrentWeek] = useState(()=>startOfWeek(new Date(),{weekStartsOn:1}))
  const [selectedUserId, setSelectedUserId] = useState('all')
  const weekStart = format(currentWeek,'yyyy-MM-dd')
  const { data: users=[] } = useQuery({ queryKey:['users'], queryFn: usersApi.list })

  return (
    <div className="max-w-full px-6 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-xl font-semibold text-gray-900">Gestão de Agenda</h1><p className="text-sm text-gray-500 mt-0.5">Alocação operacional da equipe</p></div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <User size={15} className="text-gray-400"/>
            <select value={selectedUserId} onChange={e=>setSelectedUserId(e.target.value)} className="text-sm text-gray-700 focus:outline-none bg-transparent">
              <option value="all">Todos os implantadores</option>
              {(users as any[]).map((u:any)=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {view==='week'&&(
            <div className="flex items-center gap-1">
              <button onClick={()=>setCurrentWeek(w=>subWeeks(w,1))} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><ChevronLeft size={18}/></button>
              <span className="text-sm font-medium text-gray-700 min-w-[190px] text-center">{format(currentWeek,"'Semana de' dd/MM/yyyy",{locale:ptBR})}</span>
              <button onClick={()=>setCurrentWeek(w=>addWeeks(w,1))} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><ChevronRight size={18}/></button>
            </div>
          )}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={()=>setView('week')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view==='week'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>Semanal</button>
            <button onClick={()=>setView('month')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view==='month'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>Mensal</button>
          </div>
        </div>
      </div>
      {view==='week'?<WeekView weekStart={weekStart} selectedUserId={selectedUserId}/>:<MonthView selectedUserId={selectedUserId}/>}
    </div>
  )
}
