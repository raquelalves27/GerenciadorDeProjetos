'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, AlertTriangle, CheckCircle, Activity, Clock, Users } from 'lucide-react'

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6']

const STATUS_DATA = [
  { name:'Em andamento', value:8 },
  { name:'Concluído', value:5 },
  { name:'Em risco', value:3 },
  { name:'Não iniciado', value:4 },
  { name:'Pausado', value:2 },
]

const PRODUCT_DATA = [
  { product:'ERP Pro', count:6 },
  { product:'CRM Plus', count:5 },
  { product:'Analytics', count:4 },
  { product:'DataSync', count:3 },
  { product:'HCM Suite', count:4 },
]

function KpiCard({ icon, label, value, color='blue' }: { icon: React.ReactNode; label: string; value: string|number; color?: string }) {
  const map: Record<string,string> = { blue:'bg-blue-50 text-blue-600', green:'bg-green-50 text-green-600', amber:'bg-amber-50 text-amber-600', red:'bg-red-50 text-red-600', purple:'bg-purple-50 text-purple-600' }
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${map[color]}`}>{icon}</div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

export default function Executive() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard Executivo</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão geral da operação de implantações</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard icon={<Activity size={18}/>}    label="Em andamento"    value={8}     color="blue"/>
        <KpiCard icon={<CheckCircle size={18}/>} label="Concluídos/mês"  value={5}     color="green"/>
        <KpiCard icon={<AlertTriangle size={18}/>} label="Atrasados"     value={3}     color="red"/>
        <KpiCard icon={<AlertTriangle size={18}/>} label="Em risco"      value={3}     color="amber"/>
        <KpiCard icon={<TrendingUp size={18}/>}  label="Taxa média"      value="62%"   color="purple"/>
        <KpiCard icon={<Clock size={18}/>}       label="Total projetos"  value={22}    color="blue"/>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Distribuição por status</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={STATUS_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                {STATUS_DATA.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Pie>
              <Tooltip formatter={(v)=>[`${v} projetos`]}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Projetos por produto</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={PRODUCT_DATA} layout="vertical">
              <XAxis type="number" tick={{fontSize:11}}/>
              <YAxis type="category" dataKey="product" width={80} tick={{fontSize:11}}/>
              <Tooltip/>
              <Bar dataKey="count" fill="#3B82F6" radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
