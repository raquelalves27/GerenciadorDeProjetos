'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, ChevronDown, ChevronRight, Calendar, Pencil, Trash2, X,
  Loader2, AlertTriangle, ShieldAlert, Clock, User as UserIcon
} from 'lucide-react'
import { tasksApi, clientsApi } from '@/lib/api'
import { TASK_STATUS_CONFIG, TASK_IMPACT_CONFIG, cn } from '@/lib/utils'
import type { Task, TaskStatus, TaskImpact } from '@/types'

const STATUS_ORDER: TaskStatus[] = ['a_fazer', 'em_andamento', 'aguardando_terceiro', 'atrasado', 'monitoramento', 'concluido']
const IMPACT_ORDER: TaskImpact[] = ['critico', 'alto', 'medio', 'baixo']

function useTaskForm(initial?: any, defaultClientId?: string) {
  return useState({
    client_id: initial?.client_id || defaultClientId || '',
    title: initial?.title || '',
    description: initial?.description || '',
    status: initial?.status || 'a_fazer',
    impact: initial?.impact || 'medio',
    is_blocker: initial?.is_blocker ?? false,
    responsible: initial?.responsible || '',
    waiting_on: initial?.waiting_on || '',
    due_date: initial?.due_date || '',
    due_note: initial?.due_note || '',
    escalate_to_manager: initial?.escalate_to_manager ?? false,
    escalation_reason: initial?.escalation_reason || '',
    notes: initial?.notes || '',
  })
}

function TaskModal({ initial, defaultClientId, clients, onClose }: {
  initial?: Task; defaultClientId?: string; clients: any[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useTaskForm(initial, defaultClientId)

  const mut = useMutation({
    mutationFn: (d: any) => {
      const payload = { ...d }
      if (!payload.description) delete payload.description
      if (!payload.responsible) delete payload.responsible
      if (!payload.waiting_on) delete payload.waiting_on
      if (!payload.due_date) delete payload.due_date
      if (!payload.due_note) delete payload.due_note
      if (!payload.escalation_reason) delete payload.escalation_reason
      if (!payload.notes) delete payload.notes
      return initial ? tasksApi.update(initial.id, payload) : tasksApi.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); onClose() },
  })

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const valid = form.client_id && form.title.trim().length > 0
  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-base font-semibold text-gray-900">{initial ? 'Editar tarefa' : 'Nova tarefa'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Tarefa *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Cobrar retorno sobre Gaps de Dev" className={inp} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Cliente *</label>
            <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inp}>
              <option value="">Selecione...</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {clients.length === 0 && <p className="text-xs text-amber-600 mt-1">Cadastre clientes em Configurações.</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inp}>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{TASK_STATUS_CONFIG[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Impacto</label>
            <select value={form.impact} onChange={e => set('impact', e.target.value)} className={inp}>
              {IMPACT_ORDER.map(i => <option key={i} value={i}>{TASK_IMPACT_CONFIG[i].label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Responsável</label>
            <input value={form.responsible} onChange={e => set('responsible', e.target.value)} placeholder="Ex: Raquel, Lucas, Victor de Paula" className={inp} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Aguardando de</label>
            <input value={form.waiting_on} onChange={e => set('waiting_on', e.target.value)} placeholder="Ex: Claiton, Cliente, Nadja" className={inp} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Prazo (data)</label>
            <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Prazo (texto livre)</label>
            <input value={form.due_note} onChange={e => set('due_note', e.target.value)} placeholder="Ex: Recorrente, Definir, URGENTE" className={inp} />
          </div>
          <div className="col-span-2 flex items-center gap-6 py-1">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.is_blocker} onChange={e => set('is_blocker', e.target.checked)} className="w-4 h-4 accent-red-600" />
              Impeditivo (bloqueia entrega/Go-Live)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.escalate_to_manager} onChange={e => set('escalate_to_manager', e.target.checked)} className="w-4 h-4 accent-red-600" />
              Escalar ao gestor
            </label>
          </div>
          {form.escalate_to_manager && (
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Motivo da escalação</label>
              <textarea value={form.escalation_reason} onChange={e => set('escalation_reason', e.target.value)} rows={2} className={inp + ' resize-none'} />
            </div>
          )}
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Descrição / detalhamento</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className={inp + ' resize-none'} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={inp + ' resize-none'} />
          </div>
        </div>
        {mut.isError && <p className="px-6 text-xs text-red-600">{(mut.error as any)?.response?.data?.detail || 'Erro ao salvar'}</p>}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={() => mut.mutate(form)} disabled={!valid || mut.isPending}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2">
            {mut.isPending && <Loader2 size={14} className="animate-spin" />}
            {initial ? 'Salvar' : 'Criar tarefa'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskRow({ task, clients }: { task: Task; clients: any[] }) {
  const [editing, setEditing] = useState(false)
  const qc = useQueryClient()
  const del = useMutation({ mutationFn: () => tasksApi.delete(task.id), onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }) })
  const statusCfg = TASK_STATUS_CONFIG[task.status]
  const impactCfg = TASK_IMPACT_CONFIG[task.impact]

  return (
    <>
      <div className={cn(
        'flex items-start gap-3 px-4 py-3 border-t border-gray-100 first:border-t-0',
        task.status === 'concluido' && 'opacity-50',
      )}>
        <span className={cn('mt-1.5 w-1.5 h-8 rounded-full flex-shrink-0', impactCfg.bar)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {task.is_blocker && (
              <span title="Impeditivo" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                <ShieldAlert size={11} /> Impeditivo
              </span>
            )}
            <span className={cn('text-sm font-medium text-gray-900', task.status === 'concluido' && 'line-through')}>{task.title}</span>
          </div>
          {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', statusCfg.color)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />{statusCfg.label}
            </span>
            <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', impactCfg.color)}>{impactCfg.label}</span>
            {task.responsible && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                <UserIcon size={11} />{task.responsible}
              </span>
            )}
            {task.waiting_on && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">
                Aguardando: {task.waiting_on}
              </span>
            )}
            {(task.due_date || task.due_note) && (
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border',
                task.status === 'atrasado' ? 'bg-red-50 text-red-700 border-red-200 font-medium' : 'bg-blue-50 text-blue-700 border-blue-200',
              )}>
                <Clock size={11} />{task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : task.due_note}
              </span>
            )}
            {task.escalate_to_manager && (
              <span title={task.escalation_reason || ''} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-50 text-red-700 border border-red-200 font-medium">
                <AlertTriangle size={11} /> Escalar ao gestor
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={13} /></button>
          <button onClick={() => del.mutate()} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
        </div>
      </div>
      {editing && <TaskModal initial={task} clients={clients} onClose={() => setEditing(false)} />}
    </>
  )
}

function ClientGroup({ client, tasks }: { client: any; tasks: Task[] }) {
  const [open, setOpen] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const openCount = tasks.filter(t => t.status !== 'concluido').length
  const blockerCount = tasks.filter(t => t.is_blocker && t.status !== 'concluido').length

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" onClick={() => setOpen(!open)}>
        <span className="text-gray-400 flex-shrink-0">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
        <span className="font-medium text-gray-900 text-sm flex-1">{client.name}</span>
        {blockerCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            <ShieldAlert size={11} />{blockerCount} impeditivo{blockerCount !== 1 ? 's' : ''}
          </span>
        )}
        <span className="text-xs text-gray-500">{openCount} em aberto</span>
        <button onClick={(e) => { e.stopPropagation(); setShowModal(true) }}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
          <Plus size={13} />Tarefa
        </button>
      </div>
      {open && (
        <div>
          {tasks.length === 0
            ? <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">Nenhuma tarefa com os filtros atuais.</p>
            : tasks.map(t => <TaskRow key={t.id} task={t} clients={[client]} />)}
        </div>
      )}
      {showModal && <TaskModal defaultClientId={client.id} clients={[client]} onClose={() => setShowModal(false)} />}
    </div>
  )
}

export default function TasksPage() {
  const [search, setSearch] = useState('')
  const [clientF, setClientF] = useState('')
  const [statusF, setStatusF] = useState('')
  const [impactF, setImpactF] = useState('')
  const [blockerOnly, setBlockerOnly] = useState(false)
  const [escalateOnly, setEscalateOnly] = useState(false)
  const [hideDone, setHideDone] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', search, clientF, statusF, impactF, blockerOnly, escalateOnly],
    queryFn: () => tasksApi.list({
      search: search || undefined,
      client_id: clientF || undefined,
      status: statusF || undefined,
      impact: impactF || undefined,
      is_blocker: blockerOnly || undefined,
      escalate_to_manager: escalateOnly || undefined,
    }),
  })
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: clientsApi.list })

  const allTasks: Task[] = data?.items || []
  const tasks = hideDone ? allTasks.filter(t => t.status !== 'concluido') : allTasks

  const counts = STATUS_ORDER.reduce((acc, s) => ({ ...acc, [s]: allTasks.filter(t => t.status === s).length }), {} as Record<string, number>)
  const escalateCount = allTasks.filter(t => t.escalate_to_manager && t.status !== 'concluido').length

  const visibleClients = clientF ? clients.filter((c: any) => c.id === clientF) : clients

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tarefas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestão multi-cliente — pendências, follow-ups e itens impeditivos</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Plus size={15} />Nova tarefa
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {STATUS_ORDER.map(s => (
          <button key={s} onClick={() => setStatusF(statusF === s ? '' : s)}
            className={cn('text-left p-3 rounded-xl border transition-all', statusF === s ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200')}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={cn('w-2 h-2 rounded-full', TASK_STATUS_CONFIG[s].dot)} />
              <span className="text-xs text-gray-500">{TASK_STATUS_CONFIG[s].label}</span>
            </div>
            <span className="text-lg font-semibold text-gray-800">{counts[s]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tarefa, responsável..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
        </div>
        <select value={clientF} onChange={e => setClientF(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
          <option value="">Todos os clientes</option>
          {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={impactF} onChange={e => setImpactF(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
          <option value="">Todo impacto</option>
          {IMPACT_ORDER.map(i => <option key={i} value={i}>{TASK_IMPACT_CONFIG[i].label}</option>)}
        </select>
        <button onClick={() => setBlockerOnly(!blockerOnly)}
          className={cn('px-3 py-2 text-xs font-medium rounded-lg border', blockerOnly ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-200 text-gray-600')}>
          Só impeditivos
        </button>
        <button onClick={() => setEscalateOnly(!escalateOnly)}
          className={cn('px-3 py-2 text-xs font-medium rounded-lg border', escalateOnly ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-200 text-gray-600')}>
          Escalar gestor ({escalateCount})
        </button>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} />
          Ocultar concluídas
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : clients.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <AlertTriangle size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhum cliente cadastrado</p>
          <p className="text-xs mt-1">Cadastre clientes em Configurações para começar a lançar tarefas.</p>
        </div>
      ) : (
        <div>
          {visibleClients.map((c: any) => (
            <ClientGroup key={c.id} client={c} tasks={tasks.filter(t => t.client_id === c.id)} />
          ))}
        </div>
      )}
      {showModal && <TaskModal clients={clients} onClose={() => setShowModal(false)} />}
    </div>
  )
}
