'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Circle, Clock, MessageSquare, Shield } from 'lucide-react'
import type { Project } from '@/types'
import { projectsApi } from '@/lib/api'
import { formatDate, formatDateTime, cn } from '@/lib/utils'

type Tab = 'etapas' | 'historico' | 'riscos' | 'notas'

interface ProjectDetailsProps {
  project: Project
  onUpdate?: () => void
}

export function ProjectDetails({ project, onUpdate }: ProjectDetailsProps) {
  const [tab, setTab] = useState<Tab>('etapas')

  const { data: stages } = useQuery({
    queryKey: ['project-stages', project.id],
    queryFn: () => projectsApi.getStages(project.id),
    enabled: tab === 'etapas',
  })

  const { data: updates } = useQuery({
    queryKey: ['project-updates', project.id],
    queryFn: () => projectsApi.getUpdates(project.id),
    enabled: tab === 'historico',
  })

  const { data: risks } = useQuery({
    queryKey: ['project-risks', project.id],
    queryFn: () => projectsApi.getRisks(project.id),
    enabled: tab === 'riscos',
  })

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'etapas', label: 'Etapas', icon: <CheckCircle2 size={14} /> },
    { id: 'historico', label: 'Histórico', icon: <Clock size={14} /> },
    { id: 'riscos', label: 'Riscos', icon: <AlertTriangle size={14} /> },
    { id: 'notas', label: 'Notas', icon: <MessageSquare size={14} /> },
  ]

  return (
    <div className="px-4 py-4">
      {/* Meta info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-sm">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Início</p>
          <p className="font-medium text-gray-800">
            {project.start_date ? formatDate(project.start_date) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Previsão de entrega</p>
          <p className="font-medium text-gray-800">{formatDate(project.expected_end_date)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Implantador master</p>
          <p className="font-medium text-gray-800">{project.master.name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Última atualização</p>
          <p className="font-medium text-gray-800">
            {project.last_progress_update
              ? formatDateTime(project.last_progress_update)
              : '—'}
          </p>
        </div>
      </div>

      {project.description && (
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">{project.description}</p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t transition-colors',
              tab === t.id
                ? 'text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'etapas' && (
        <div className="space-y-2">
          {stages?.map((stage: NonNullable<Project['stages']>[number]) => (
            <div key={stage.id} className="flex items-start gap-3 text-sm">
              <div className="mt-0.5">
                {stage.status === 'concluido'
                  ? <CheckCircle2 size={16} className="text-green-500" />
                  : stage.status === 'em_andamento'
                    ? <Circle size={16} className="text-blue-500 fill-blue-100" />
                    : stage.status === 'bloqueado'
                      ? <AlertTriangle size={16} className="text-red-500" />
                      : <Circle size={16} className="text-gray-300" />}
              </div>
              <div className="flex-1">
                <span className={cn(
                  'font-medium',
                  stage.status === 'concluido' ? 'text-gray-400 line-through' : 'text-gray-800'
                )}>
                  {stage.name}
                </span>
                {stage.owner && (
                  <span className="text-xs text-gray-500 ml-2">• {stage.owner.name}</span>
                )}
                {stage.due_date && (
                  <span className="text-xs text-gray-400 ml-2">{formatDate(stage.due_date)}</span>
                )}
              </div>
            </div>
          ))}
          {!stages?.length && (
            <p className="text-xs text-gray-400">Nenhuma etapa cadastrada</p>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div className="space-y-3">
          {updates?.map((update: NonNullable<Project['updates']>[number]) => (
            <div key={update.id} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
                {update.author.name[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-700">{update.author.name}</span>
                  <span className="text-xs text-gray-400">{formatDateTime(update.created_at)}</span>
                  <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                    {update.completion_pct_snapshot}%
                  </span>
                </div>
                <p className="text-sm text-gray-600">{update.content}</p>
              </div>
            </div>
          ))}
          {!updates?.length && (
            <p className="text-xs text-gray-400">Nenhuma atualização registrada</p>
          )}
        </div>
      )}

      {tab === 'riscos' && (
        <div className="space-y-2">
          {risks?.map((risk: NonNullable<Project['risks']>[number]) => {
            const severity = {
              baixo: 'bg-green-50 text-green-700 border-green-200',
              medio: 'bg-amber-50 text-amber-700 border-amber-200',
              alto: 'bg-orange-50 text-orange-700 border-orange-200',
              critico: 'bg-red-50 text-red-700 border-red-200',
            }[risk.severity] || 'bg-gray-50 text-gray-700 border-gray-200'

            return (
              <div key={risk.id} className="flex gap-3 p-3 rounded-lg bg-gray-50">
                <Shield size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full border font-medium',
                      severity
                    )}>
                      {risk.severity}
                    </span>
                    <span className="text-xs text-gray-400">{risk.status}</span>
                  </div>
                  <p className="text-sm text-gray-700">{risk.description}</p>
                  {risk.mitigation && (
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="font-medium">Mitigação:</span> {risk.mitigation}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          {!risks?.length && (
            <p className="text-xs text-gray-400">Nenhum risco registrado</p>
          )}
        </div>
      )}

      {tab === 'notas' && (
        <div>
          {project.internal_notes
            ? <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {project.internal_notes}
              </p>
            : <p className="text-xs text-gray-400">Sem observações internas</p>
          }
        </div>
      )}
    </div>
  )
}
