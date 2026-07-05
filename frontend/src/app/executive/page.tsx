'use client'

import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import {
  TrendingUp, AlertTriangle, CheckCircle, Activity, Clock, Users,
  Loader2, ArrowRight, Trophy, UserMinus
} from 'lucide-react'
import { kpisApi } from '@/lib/api'
import { STATUS_CONFIG } from '@/lib/utils'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

function KpiCard({ icon, label, value, color = 'blue' }: { icon: React.ReactNode; label: string; value: string | number; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600', purple: 'bg-purple-50 text-purple-600' }
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${map[color]}`}>{icon}</div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
      <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  )
}

export default function Executive() {
  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ['kpis', 'executive'],
    queryFn: () => kpisApi.executive(),
  })
  const { data: alloc, isLoading: loadingAlloc } = useQuery({
    queryKey: ['kpis', 'allocation-insights'],
    queryFn: () => kpisApi.allocationInsights(),
  })

  const statusData = (kpis?.status_distribution || []).map((s: any) => ({
    name: STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG]?.label || s.status,
    value: s.count,
  }))
  const productData = (kpis?.product_distribution || []).map((p: any) => ({ product: p.product, count: p.count }))

  const byClientTotal = alloc?.by_client_total || []
  const byProfessionalTotal = alloc?.by_professional_total || []
  const byProfessionalClient = alloc?.by_professional_client || []
  const topPair = alloc?.top_pair
  const leastClient = alloc?.least_allocated_client
  const mostClient = alloc?.most_allocated_client

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard Executivo</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão geral da operação de implantações</p>
      </div>

      {loadingKpis ? (
        <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-blue-500" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <KpiCard icon={<Activity size={18} />} label="Em andamento" value={kpis?.em_andamento ?? 0} color="blue" />
            <KpiCard icon={<CheckCircle size={18} />} label="Concluídos" value={kpis?.concluidos_mes ?? 0} color="green" />
            <KpiCard icon={<AlertTriangle size={18} />} label="Em risco" value={kpis?.em_risco ?? 0} color="amber" />
            <KpiCard icon={<TrendingUp size={18} />} label="Taxa média de conclusão" value={`${kpis?.taxa_media_conclusao ?? 0}%`} color="purple" />
            <KpiCard icon={<Clock size={18} />} label="Total de projetos" value={kpis?.total_projects ?? 0} color="blue" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Distribuição por status</h3>
              {statusData.length === 0 ? <p className="text-sm text-gray-400 py-10 text-center">Sem projetos cadastrados ainda.</p> : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                      {statusData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v} projetos`]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Projetos por produto</h3>
              {productData.length === 0 ? <p className="text-sm text-gray-400 py-10 text-center">Sem projetos cadastrados ainda.</p> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={productData} layout="vertical">
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="product" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Insights de agenda alocada ──────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-1 mt-2">
        <Users size={16} className="text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-800">Insights de agenda alocada</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4">Considerando todo o histórico de alocações (Agenda Semanal), em turnos.</p>

      {loadingAlloc ? (
        <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-blue-500" /></div>
      ) : byProfessionalClient.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400 mb-6">
          <p className="text-sm font-medium">Ainda não há alocações lançadas na Agenda Semanal.</p>
          <p className="text-xs mt-1">Assim que houver alocações, este painel mostra quem atende mais cada cliente e quem está com menos agenda.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {topPair && (
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="inline-flex p-2 rounded-lg mb-3 bg-blue-50 text-blue-600"><Trophy size={18} /></div>
                <p className="text-sm font-semibold text-gray-900">{topPair.user_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">é quem mais atende <span className="font-medium text-gray-700">{topPair.client_name}</span> — {topPair.shifts} turno{topPair.shifts !== 1 ? 's' : ''}</p>
              </div>
            )}
            {leastClient && (
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="inline-flex p-2 rounded-lg mb-3 bg-amber-50 text-amber-600"><UserMinus size={18} /></div>
                <p className="text-sm font-semibold text-gray-900">{leastClient.client_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">é o cliente com <span className="font-medium text-gray-700">menos alocações</span> — {leastClient.shifts} turno{leastClient.shifts !== 1 ? 's' : ''} no período</p>
              </div>
            )}
            {mostClient && (
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="inline-flex p-2 rounded-lg mb-3 bg-green-50 text-green-600"><TrendingUp size={18} /></div>
                <p className="text-sm font-semibold text-gray-900">{mostClient.client_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">é o cliente com <span className="font-medium text-gray-700">mais alocações</span> — {mostClient.shifts} turno{mostClient.shifts !== 1 ? 's' : ''} no período</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Section title="Alocações por cliente" subtitle="Do menor para o maior — bom radar para quem está com pouca dedicação da equipe.">
              <ResponsiveContainer width="100%" height={Math.max(160, byClientTotal.length * 32)}>
                <BarChart data={byClientTotal} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="client_name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} turnos`]} />
                  <Bar dataKey="shifts" radius={[0, 4, 4, 0]}>
                    {byClientTotal.map((c: any, i: number) => (
                      <Cell key={i} fill={c.shifts === 0 ? '#F87171' : '#3B82F6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Carga por profissional (total)" subtitle="Soma de turnos alocados em todos os clientes.">
              <ResponsiveContainer width="100%" height={Math.max(160, byProfessionalTotal.length * 32)}>
                <BarChart data={byProfessionalTotal} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="user_name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} turnos`]} />
                  <Bar dataKey="shifts" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          <Section title="Profissional × Cliente" subtitle="Ranking de quem atende quem — use para decidir realocação ou reforço.">
            <div className="space-y-1.5">
              {byProfessionalClient.slice(0, 12).map((row: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-sm font-medium text-gray-800">{row.user_name}</span>
                  <ArrowRight size={12} className="text-gray-300 flex-shrink-0" />
                  <span className="text-sm text-gray-600 flex-1">{row.client_name}</span>
                  <span className="text-xs font-medium text-gray-500">{row.shifts} turno{row.shifts !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
