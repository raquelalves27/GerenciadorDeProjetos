'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Clock, Calendar, User } from 'lucide-react'
import type { Project } from '@/types'
import {
  STATUS_CONFIG, PRIORITY_CONFIG,
  formatDate, isOverdue, daysUntilDeadline,
  progressColor, getInitials, cn
} from '@/lib/utils'
import { ProjectDetails } from './ProjectDetails'

interface ProjectCardProps {
  project: Project
  onUpdate?: () => void
}

export function ProjectCard({ project, onUpdate }: ProjectCardProps) {
  const [expanded, setExpanded] = useState(false)
  const statusCfg = STATUS_CONFIG[project.status]
  const priorityCfg = PRIORITY_CONFIG[project.priority]
  const overdue = isOverdue(project.expected_end_date)
  const daysLeft = daysUntilDeadline(project.expected_end_date)
  const barColor = progressColor(project.completion_pct, project.status)

  return (
    <div className={cn(
      'bg-white border rounded-xl overflow-hidden transition-all duration-200',
      overdue && project.status !== 'concluido' && project.status !== 'pausado'
        ? 'border-red-200 shadow-sm shadow-red-50'
        : 'border-gray-200 hover:border-gray-300',
    )}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand arrow */}
        <button className="text-gray-400 flex-shrink-0">
          {expanded
            ? <ChevronDown size={16} />
            : <ChevronRight size={16} />}
        </button>

        {/* Cliente + Projeto */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm truncate">
              {project.client.name}
            </span>
            <span className="text-gray-400 text-xs">·</span>
            <span className="text-gray-600 text-sm truncate">{project.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{project.product.name}</span>
          </div>
        </div>

        {/* Master implantador */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-medium">
            {getInitials(project.master.name)}
          </div>
          <span className="text-xs text-gray-600 max-w-[100px] truncate">
            {project.master.name}
          </span>
        </div>

        {/* Progress bar */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0 w-36">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: `${project.completion_pct}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-700 w-8 text-right">
            {project.completion_pct}%
          </span>
        </div>

        {/* Status badge */}
        <span className={cn(
          'hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0',
          statusCfg.color
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
          {statusCfg.label}
        </span>

        {/* Priority */}
        <span className={cn(
          'hidden lg:inline-flex px-2 py-0.5 rounded text-xs font-medium flex-shrink-0',
          priorityCfg.color
        )}>
          {priorityCfg.label}
        </span>

        {/* Deadline */}
        <div className="flex-shrink-0 text-right">
          <div className={cn(
            'flex items-center gap-1 text-xs',
            overdue && project.status !== 'concluido'
              ? 'text-red-600 font-medium'
              : daysLeft <= 14 ? 'text-amber-600' : 'text-gray-500'
          )}>
            {overdue && project.status !== 'concluido'
              ? <AlertTriangle size={12} />
              : <Calendar size={12} />}
            {project.status === 'concluido'
              ? <span>Concluído</span>
              : overdue
                ? <span>Atrasado {Math.abs(daysLeft)}d</span>
                : <span>{formatDate(project.expected_end_date)}</span>
            }
          </div>
        </div>
      </div>

      {/* Mobile progress bar */}
      <div className="md:hidden px-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={cn('h-full rounded-full', barColor)}
              style={{ width: `${project.completion_pct}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-700">{project.completion_pct}%</span>
        </div>
      </div>

      {/* ─── Expanded Details ────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-gray-100">
          <ProjectDetails project={project} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  )
}
