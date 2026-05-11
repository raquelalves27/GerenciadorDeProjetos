import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ProjectStatus, ProjectPriority, ShiftType, AlertType } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Status configs ───────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; color: string; dot: string }
> = {
  nao_iniciado: {
    label: 'Não iniciado',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: 'bg-gray-400',
  },
  em_andamento: {
    label: 'Em andamento',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  em_risco: {
    label: 'Em risco',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  concluido: {
    label: 'Concluído',
    color: 'bg-green-50 text-green-700 border-green-200',
    dot: 'bg-green-500',
  },
  pausado: {
    label: 'Pausado',
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
}

export const PRIORITY_CONFIG: Record<
  ProjectPriority,
  { label: string; color: string }
> = {
  baixa: { label: 'Baixa', color: 'bg-slate-100 text-slate-600' },
  media: { label: 'Média', color: 'bg-blue-50 text-blue-700' },
  alta: { label: 'Alta', color: 'bg-orange-50 text-orange-700' },
  critica: { label: 'Crítica', color: 'bg-red-50 text-red-700' },
}

export const SHIFT_CONFIG: Record<ShiftType, { label: string; icon: string; color: string }> = {
  manha: { label: 'Manhã', icon: '🌅', color: 'bg-amber-50 border-amber-200' },
  tarde: { label: 'Tarde', icon: '☀️', color: 'bg-orange-50 border-orange-200' },
  noite: { label: 'Noite', icon: '🌙', color: 'bg-indigo-50 border-indigo-200' },
}

export const ALERT_CONFIG: Record<AlertType, { label: string; color: string }> = {
  conflito_horario: { label: 'Conflito de horário', color: 'text-red-600 bg-red-50' },
  sobrecarga: { label: 'Sobrecarga', color: 'text-orange-600 bg-orange-50' },
  projeto_atrasado: { label: 'Projeto atrasado', color: 'text-red-700 bg-red-50' },
  sem_evolucao: { label: 'Sem evolução', color: 'text-amber-700 bg-amber-50' },
  prazo_proximo: { label: 'Prazo próximo', color: 'text-yellow-700 bg-yellow-50' },
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function formatDate(dateStr: string, fmt = 'dd/MM/yyyy') {
  try {
    return format(parseISO(dateStr), fmt, { locale: ptBR })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string) {
  return formatDate(dateStr, "dd/MM/yyyy 'às' HH:mm")
}

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isOverdue(expectedEnd: string): boolean {
  return differenceInDays(new Date(), parseISO(expectedEnd)) > 0
}

export function daysUntilDeadline(expectedEnd: string): number {
  return differenceInDays(parseISO(expectedEnd), new Date())
}

// ─── Progress bar color ───────────────────────────────────────────────────────

export function progressColor(pct: number, status: ProjectStatus): string {
  if (status === 'concluido') return 'bg-green-500'
  if (status === 'em_risco') return 'bg-amber-500'
  if (status === 'pausado') return 'bg-slate-400'
  if (pct < 30) return 'bg-red-400'
  if (pct < 70) return 'bg-blue-500'
  return 'bg-green-500'
}

// ─── User initials ────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function avatarColors(name: string): string {
  const colors = [
    'bg-purple-100 text-purple-700',
    'bg-blue-100 text-blue-700',
    'bg-teal-100 text-teal-700',
    'bg-green-100 text-green-700',
    'bg-amber-100 text-amber-700',
    'bg-coral-100 text-coral-700',
  ]
  const idx = name.charCodeAt(0) % colors.length
  return colors[idx]
}
