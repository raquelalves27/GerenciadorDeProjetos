// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'gestor' | 'implantador'

export type ProjectStatus =
  | 'nao_iniciado'
  | 'em_andamento'
  | 'em_risco'
  | 'concluido'
  | 'pausado'

export type ProjectPriority = 'baixa' | 'media' | 'alta' | 'critica'

export type ShiftType = 'manha' | 'tarde' | 'noite'

export type ActivityType =
  | 'implantacao'
  | 'treinamento'
  | 'suporte'
  | 'reuniao'
  | 'configuracao'

export type AlertType =
  | 'conflito_horario'
  | 'sobrecarga'
  | 'projeto_atrasado'
  | 'sem_evolucao'
  | 'prazo_proximo'

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  org_id: string
  avatar_url?: string
  weekly_capacity_hours: number
  is_active: boolean
  created_at: string
}

export interface Client {
  id: string
  name: string
  contact_name?: string
  contact_email?: string
}

export interface Product {
  id: string
  name: string
  description?: string
}

export interface Project {
  id: string
  name: string
  client: Client
  product: Product
  master: User
  status: ProjectStatus
  priority: ProjectPriority
  completion_pct: number
  start_date?: string
  expected_end_date: string
  actual_end_date?: string
  description?: string
  internal_notes?: string
  last_progress_update?: string
  created_at: string
  updated_at?: string
  // Expandido
  stages?: ProjectStage[]
  updates?: ProjectUpdate[]
  risks?: Risk[]
}

export interface ProjectStage {
  id: string
  project_id: string
  name: string
  description?: string
  status: 'pendente' | 'em_andamento' | 'concluido' | 'bloqueado'
  owner?: User
  due_date?: string
  order_idx: number
}

export interface ProjectUpdate {
  id: string
  project_id: string
  author: User
  content: string
  completion_pct_snapshot: number
  status_snapshot: ProjectStatus
  created_at: string
}

export interface Risk {
  id: string
  project_id: string
  description: string
  severity: 'baixo' | 'medio' | 'alto' | 'critico'
  status: string
  mitigation?: string
  created_at: string
}

export interface Allocation {
  id: string
  user: User
  project: Project
  week_start: string
  shift: ShiftType
  activity_type: ActivityType
  start_time?: string
  end_time?: string
  repeat_weekly: boolean
  notes?: string
}

export interface Alert {
  id: string
  alert_type: AlertType
  entity_type: string
  entity_id: string
  message: string
  is_read: boolean
  created_at: string
}

export interface AuditLog {
  id: string
  user: User
  entity_type: string
  entity_id: string
  action: 'create' | 'update' | 'delete'
  before_data?: Record<string, unknown>
  after_data?: Record<string, unknown>
  created_at: string
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ProjectFilters {
  status?: ProjectStatus
  priority?: ProjectPriority
  master_id?: string
  product_id?: string
  client_id?: string
  search?: string
  start_from?: string
  start_to?: string
  page?: number
  size?: number
}

export interface WeekSchedule {
  [userId: string]: {
    user: User
    shifts: {
      manha: Allocation[]
      tarde: Allocation[]
      noite: Allocation[]
    }
  }
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export interface ExecutiveKpis {
  total_projects: number
  em_andamento: number
  concluidos_mes: number
  atrasados: number
  em_risco: number
  taxa_media_conclusao: number
  product_distribution: Array<{ product: string; count: number }>
  status_distribution: Array<{ status: ProjectStatus; count: number }>
  priority_distribution: Array<{ priority: ProjectPriority; count: number }>
  recent_completions: Project[]
  at_risk_projects: Project[]
}

export interface TeamCapacity {
  total_implantadores: number
  implantadores: Array<{
    user: User
    allocated_shifts: number
    capacity_shifts: number
    occupancy_pct: number
  }>
  week_start: string
}
