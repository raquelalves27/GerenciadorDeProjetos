'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  Compass, ShieldAlert, AlertTriangle, Clock, Users, Loader2, ArrowRight, Flame
} from 'lucide-react'
import { tasksApi, clientsApi } from '@/lib/api'
import { TASK_STATUS_CONFIG, TASK_IMPACT_CONFIG, cn } from '@/lib/utils'
import type { Task } from '@/types'

const IMPACT_WEIGHT: Record<string, number> = { critico: 4, alto: 3, medio: 2, baixo: 1 }

function priorityScore(t: Task): number {
  let score = IMPACT_WEIGHT[t.impact] ?? 2
  if (t.is_blocker) score += 3
  if (t.escalate_to_manager) score += 2
  if (t.status === 'atrasado') score += 2
  if (t.status === 'aguardando_terceiro') score += 1
  return score
}

function reasonChips(t: Task) {
  const chips: string[] = []
  if (t.status === 'atrasado') chips.push('Atrasado')
  if (t.is_blocker) chips.push('Impeditivo')
  if (t.escalate_to_manager) chips.push('Escalar ao gestor')
  if (t.impact === 'critico') chips.push('Impacto crítico')
  if (t.status === 'aguardando_terceiro' && t.waiting_on) chips.push(`Aguardando ${t.waiting_on}`)
  return chips
}

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-gray-500 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  )
}

export default function DecisionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'decisions-all'],
    queryFn: () => tasksApi.list({ size: 500 }),
  })
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: clientsApi.list })

  const tasks: Task[] = (data?.items || []).filter((t: Task) => t.status !== 'concluido')
  const clientName = (id: string) => clients.find((c: any) => c.id === id)?.name || '—'

  const ranked = useMemo(
    () => [...tasks].sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 8),
    [tasks]
  )

  const byResponsible = useMemo(() => {
    const map: Record<string, number> = {}
    tasks.forEach(t => {
      const key = t.responsible?.trim() || 'Sem responsável definido'
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8)
  }, [tasks])

  const byClient = useMemo(() => {
    const map: Record<string, { name: string; score: number; blockers: number; escalations: number; overdue: number }> = {}
    tasks.forEach(t => {
      const name = clientName(t.client_id)
      if (!map[name]) map[name] = { name, score: 0, blockers: 0, escalations: 0, overdue: 0 }
      map[name].score += priorityScore(t)
      if (t.is_blocker) map[name].blockers += 1
      if (t.escalate_to_manager) map[name].escalations += 1
      if (t.status === 'atrasado') map[name].overdue += 1
    })
    return Object.values(map).sort((a, b) => b.score - a.score)
  }, [tasks, clients])

  const recommendations = useMemo(() => {
    const recs: string[] = []
    byClient.slice(0, 3).forEach(c => {
      if (c.blockers > 0 || c.escalations > 0) {
        const parts = []
        if (c.blockers > 0) parts.push(`${c.blockers} item${c.blockers > 1 ? 's' : ''} impeditivo${c.blockers > 1 ? 's' : ''}`)
        if (c.escalations > 0) parts.push(`${c.escalations} pedindo escalação`)
        recs.push(`${c.name} concentra ${parts.join(' e ')} — priorize essa conta esta semana.`)
      }
    })
    const overloaded = byResponsible.find(r => r.count >= 5 && r.name !== 'Sem responsável definido')
    if (overloaded) {
      recs.push(`${overloaded.name} está com ${overloaded.count} itens em aberto — avalie redistribuir ou delegar parte da carga.`)
    }
    const semResp = tasks.filter(t => !t.responsible?.trim())
    if (semResp.length > 0) {
      recs.push(`${semResp.length} tarefa${semResp.length > 1 ? 's' : ''} sem responsável definido — defina o dono antes de virarem gargalo.`)
    }
    const criticosParados = tasks.filter(t => t.impact === 'critico' && t.status === 'a_fazer')
    if (criticosParados.length > 0) {
      recs.push(`${criticosParados.length} item${criticosParados.length > 1 ? 's' : ''} de impacto crítico ainda não iniciado${criticosParados.length > 1 ? 's' : ''} — considere começar por aqui.`)
    }
    return recs
  }, [byClient, byResponsible, tasks])

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Compass size={20} className="text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Central de Decisão</h1>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">Para onde olhar primeiro, com base nas tarefas em aberto agora</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-2xl font-semibold text-gray-900">{tasks.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Tarefas em aberto</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-2xl font-semibold text-red-600">{tasks.filter(t => t.is_blocker).length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Itens impeditivos</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-2xl font-semibold text-red-600">{tasks.filter(t => t.escalate_to_manager).length}</p>
          <p className="text-xs text-gray-500 mt-0.5">A escalar ao gestor</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-2xl font-semibold text-amber-600">{tasks.filter(t => t.status === 'atrasado').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Atrasadas</p>
        </div>
      </div>

      {recommendations.length > 0 && (
        <Section icon={<Flame size={16} />} title="Recomendações" subtitle="Leituras automáticas a partir dos dados atuais — use como ponto de partida, não como veredito.">
          <ul className="space-y-2">
            {recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <ArrowRight size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section icon={<AlertTriangle size={16} />} title="O que fazer agora" subtitle="Tarefas em aberto ordenadas por urgência (impacto + impeditivo + escalação + atraso).">
        {ranked.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma tarefa em aberto — painel limpo.</p>
        ) : (
          <div className="space-y-2">
            {ranked.map((t, idx) => {
              const cfg = TASK_STATUS_CONFIG[t.status]
              const impactCfg = TASK_IMPACT_CONFIG[t.impact]
              return (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-500">{clientName(t.client_id)}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-sm font-medium text-gray-900">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-[11px] font-medium', impactCfg.color)}>{impactCfg.label}</span>
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border', cfg.color)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />{cfg.label}
                      </span>
                      {reasonChips(t).map((c, i) => (
                        <span key={i} className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section icon={<Users size={16} />} title="Carga por responsável" subtitle="Tarefas em aberto por pessoa — ajuda a decidir o que delegar.">
          {byResponsible.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados suficientes.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, byResponsible.length * 34)}>
              <BarChart data={byResponsible} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} tarefas`]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {byResponsible.map((r, i) => (
                    <Cell key={i} fill={r.count >= 5 ? '#DC2626' : '#3B82F6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section icon={<ShieldAlert size={16} />} title="Clientes que pedem atenção" subtitle="Ranking por impeditivos, escalações e atrasos em aberto.">
          {byClient.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados suficientes.</p>
          ) : (
            <div className="space-y-2">
              {byClient.slice(0, 6).map((c, i) => (
                <div key={c.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-sm font-medium text-gray-800 flex-1 truncate">{c.name}</span>
                  {c.blockers > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">{c.blockers} impeditivo{c.blockers > 1 ? 's' : ''}</span>}
                  {c.escalations > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">{c.escalations} escalar</span>}
                  {c.overdue > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 flex items-center gap-1"><Clock size={10} />{c.overdue} atrasada{c.overdue > 1 ? 's' : ''}</span>}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
