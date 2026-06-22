'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, ChevronLeft, ChevronRight, Copy, Loader2, User, MessageCircle } from 'lucide-react'
import { format, addWeeks, subWeeks, startOfWeek, addDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { scheduleApi, usersApi, projectsApi, clientsApi } from '@/lib/api'

const SHIFTS = [
  { key:'manha', label:'Manhã', emoji:'🌅', bg:'bg-amber-50', badge:'bg-amber-50 text-amber-700 border-amber-200' },
  { key:'tarde', label:'Tarde', emoji:'☀️', bg:'bg-orange-50', badge:'bg-orange-50 text-orange-700 border-orange-200' },
]
const ACTIVITY_TYPES = [
  { label:'Implantação', value:'implantacao' },
  { label:'Treinamento', value:'treinamento' },
  { label:'Suporte',     value:'suporte' },
  { label:'Reunião',     value:'reuniao' },
  { label:'Configuração',value:'configuracao' },
]
const COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-orange-100 text-orange-800 border-orange-200',
]
const WEEK_DAYS = [
  { key: 0, label: 'Segunda' },
  { key: 1, label: 'Terça' },
  { key: 2, label: 'Quarta' },
  { key: 3, label: 'Quinta' },
  { key: 4, label: 'Sexta' },
]

function getInitials(name: string) {
  return name?.split(' ').slice(0,2).map((n:string)=>n[0]).join('').toUpperCase()||'?'
}

// ─── Geração do texto da agenda semanal para envio via WhatsApp ───────────────
function buildWhatsappScheduleText({
  users, schedule, clients, weekStart,
}: { users: any[]; schedule: Record<string, any>; clients: any[]; weekStart: string }) {
  const SHIFT_EMOJI: Record<string, string> = { manha: '🌅', tarde: '☀️' }
  const SHIFT_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde' }

  const weekDates = WEEK_DAYS.map(d => ({
    ...d,
    dateStr: format(addDays(new Date(weekStart + 'T12:00:00'), d.key), 'dd/MM'),
  }))
  const periodLabel = `${weekDates[0].dateStr} a ${weekDates[weekDates.length - 1].dateStr}`

  const clientName = (a: any) => {
    const proj = a.project || {}
    const c = clients.find((c: any) => c.id === proj.client_id)
    return c?.name || proj.name || '—'
  }

  let text = `📅 *AGENDA SEMANAL — IMPLANTADORES*\n🗓️ Semana de ${periodLabel}\n`
  text += '━━━━━━━━━━━━━━━━━━━━\n'

  const usersWithAllocations = users.filter((user: any) => {
    const ua = schedule[user.id] || {}
    return ['manha', 'tarde'].some(sh => (ua[sh] || []).length > 0)
  })

  if (usersWithAllocations.length === 0) {
    text += '\nNenhuma alocação cadastrada para esta semana.\n'
  }

  usersWithAllocations.forEach((user: any) => {
    const userAllocs = schedule[user.id] || {}
    text += `\n👤 *${user.name.toUpperCase()}*\n`

    weekDates.forEach(day => {
      const dayStr = format(addDays(new Date(weekStart + 'T12:00:00'), day.key), 'yyyy-MM-dd')
      const lines: string[] = []

      ;['manha', 'tarde'].forEach(sh => {
        const items = (userAllocs[sh] || []).filter((a: any) => (a.day || a.week_start) === dayStr)
        if (items.length > 0) {
          const names = items.map((a: any) => clientName(a)).join(', ')
          lines.push(`   ${SHIFT_EMOJI[sh]} ${SHIFT_LABEL[sh]}: ${names}`)
        }
      })

      if (lines.length > 0) {
        text += `*${day.label} (${day.dateStr})*\n${lines.join('\n')}\n`
      }
    })
  })

  text += '\n━━━━━━━━━━━━━━━━━━━━\n_Agenda gerada automaticamente_'
  return text
}

// ─── Paleta de cores fixa por cliente (determinística pelo nome) ─────────────
const CLIENT_PALETTE = [
  '#E63946', // vermelho
  '#7B2CBF', // roxo
  '#2A9D8F', // verde-azulado
  '#B8860B', // dourado/oliva
  '#1D8FD9', // azul
  '#E76F51', // laranja
  '#D62894', // rosa forte
  '#264653', // azul petróleo
  '#52B788', // verde
  '#9C6644', // marrom
]
// Cores fixas para os clientes mais recorrentes, para manter uma identidade
// visual estável independente do hash (case-insensitive, por prefixo do nome)
const CLIENT_COLOR_OVERRIDES: Record<string, string> = {
  'prohospital': '#E63946',
  'provix': '#7B2CBF',
  'açaí belo norte': '#B8860B',
  'acai belo norte': '#B8860B',
  'nazaria': '#2A9D8F',
  'redepharma': '#1D8FD9',
  'rede pharma': '#1D8FD9',
  'am farma': '#E76F51',
  'amfarma': '#E76F51',
  'prisma': '#111827',
  'independente': '#F472B6',
  'agil': '#84CC16',
  'agil marinho': '#84CC16',
  'casa do médico': '#264653',
  'casa do medico': '#264653',
}
function colorForClient(name: string) {
  const key = name.trim().toLowerCase()
  if (CLIENT_COLOR_OVERRIDES[key]) return CLIENT_COLOR_OVERRIDES[key]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return CLIENT_PALETTE[hash % CLIENT_PALETTE.length]
}

// ─── Geração da imagem da agenda semanal (canvas) ─────────────────────────────
function buildScheduleImageDataUrl({
  users, schedule, clients, weekStart,
}: { users: any[]; schedule: Record<string, any>; clients: any[]; weekStart: string }): string | null {
  if (typeof document === 'undefined') return null

  const weekDates = WEEK_DAYS.map(d => ({
    ...d,
    dateStr: format(addDays(new Date(weekStart + 'T12:00:00'), d.key), 'dd/MM'),
    dayStr: format(addDays(new Date(weekStart + 'T12:00:00'), d.key), 'yyyy-MM-dd'),
  }))

  const clientName = (a: any) => {
    const proj = a.project || {}
    const c = clients.find((c: any) => c.id === proj.client_id)
    return c?.name || proj.name || '—'
  }

  const usersWithAllocations = users.filter((user: any) => {
    const ua = schedule[user.id] || {}
    return ['manha', 'tarde'].some(sh => (ua[sh] || []).length > 0)
  })
  const rows = usersWithAllocations.length > 0 ? usersWithAllocations : users

  // ─ Layout
  const nameColW = 190
  const shiftColW = 56
  const dayColW = 230
  const headerH = 70
  const rowH = 56 // altura de cada linha de turno (M ou T)
  const titleH = 64
  const padding = 24
  const width = padding * 2 + nameColW + shiftColW + dayColW * weekDates.length
  const bodyH = rows.length * rowH * 2
  const height = titleH + headerH + bodyH + padding

  const canvas = document.createElement('canvas')
  const scale = 2 // melhora nitidez (retina)
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(scale, scale)

  // Fundo
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Título
  ctx.fillStyle = '#1f2937'
  ctx.font = '600 22px Arial, sans-serif'
  ctx.textBaseline = 'middle'
  const periodLabel = `${weekDates[0].dateStr} a ${weekDates[weekDates.length - 1].dateStr}`
  ctx.fillText(`Agenda Semanal — Implantadores`, padding, padding + 14)
  ctx.font = '400 14px Arial, sans-serif'
  ctx.fillStyle = '#6b7280'
  ctx.fillText(`Semana de ${periodLabel}`, padding, padding + 38)

  let y = titleH

  // Cabeçalho dos dias
  ctx.fillStyle = '#FDE68A' // amarelo claro, como no modelo
  ctx.fillRect(padding + nameColW + shiftColW, y, dayColW * weekDates.length, headerH)
  ctx.fillStyle = '#111827'
  ctx.font = '700 15px Arial, sans-serif'
  ctx.textAlign = 'center'
  weekDates.forEach((d, i) => {
    const cx = padding + nameColW + shiftColW + dayColW * i + dayColW / 2
    ctx.fillText(d.label.toUpperCase(), cx, y + headerH / 2)
  })
  ctx.textAlign = 'left'
  y += headerH

  const tableTop = y
  const tableLeft = padding
  const tableWidth = nameColW + shiftColW + dayColW * weekDates.length

  rows.forEach((user: any, ri: number) => {
    const userAllocs = schedule[user.id] || {}
    const rowTop = y

    // Faixa de fundo do nome (cor salmão clara, como no print)
    ctx.fillStyle = ri % 2 === 0 ? '#F6CFA9' : '#F8DBC0'
    ctx.fillRect(tableLeft, rowTop, nameColW, rowH * 2)

    // Nome do implantador (centralizado verticalmente nas duas linhas)
    ctx.fillStyle = '#1f2937'
    ctx.font = '700 15px Arial, sans-serif'
    ctx.textAlign = 'left'
    const nameLines = user.name.toUpperCase().split(' ')
    ctx.fillText(nameLines[0] || user.name.toUpperCase(), tableLeft + 14, rowTop + rowH)

    ;['manha', 'tarde'].forEach((sh, si) => {
      const cellTop = rowTop + si * rowH

      // Badge M/T
      const badgeColor = sh === 'manha' ? '#1D3557' : '#9D2933'
      const badgeCx = tableLeft + nameColW + shiftColW / 2
      const badgeCy = cellTop + rowH / 2
      ctx.beginPath()
      ctx.arc(badgeCx, badgeCy, 14, 0, Math.PI * 2)
      ctx.fillStyle = badgeColor
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = '700 13px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(sh === 'manha' ? 'M' : 'T', badgeCx, badgeCy + 1)
      ctx.textAlign = 'left'

      // Pílulas por dia
      weekDates.forEach((day, di) => {
        const cellLeft = tableLeft + nameColW + shiftColW + dayColW * di
        const items = (userAllocs[sh] || []).filter((a: any) => (a.day || a.week_start) === day.dayStr)

        // Borda da célula
        ctx.strokeStyle = '#e5e7eb'
        ctx.lineWidth = 1
        ctx.strokeRect(cellLeft, cellTop, dayColW, rowH)

        if (items.length > 0) {
          const label = items.map((a: any) => clientName(a)).join(' + ')
          const pillX = cellLeft + 8
          const pillY = cellTop + 6
          const pillW = dayColW - 16
          const pillH = rowH - 12
          const radius = pillH / 2

          ctx.fillStyle = colorForClient(label)
          ctx.beginPath()
          ctx.moveTo(pillX + radius, pillY)
          ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, radius)
          ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, radius)
          ctx.arcTo(pillX, pillY + pillH, pillX, pillY, radius)
          ctx.arcTo(pillX, pillY, pillX + pillW, pillY, radius)
          ctx.closePath()
          ctx.fill()

          ctx.fillStyle = '#ffffff'
          ctx.font = '700 12px Arial, sans-serif'
          ctx.textAlign = 'center'
          // Trunca texto se não couber
          let display = label.toUpperCase()
          const maxW = pillW - 16
          while (ctx.measureText(display).width > maxW && display.length > 3) {
            display = display.slice(0, -2)
          }
          if (display !== label.toUpperCase()) display = display.trim() + '…'
          ctx.fillText(display, pillX + pillW / 2, pillY + pillH / 2 + 1)
          ctx.textAlign = 'left'
        }
      })
    })

    y += rowH * 2
  })

  // Bordas externas e linhas verticais da tabela
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1.5
  ctx.strokeRect(tableLeft, tableTop, tableWidth, y - tableTop)
  ctx.beginPath()
  ctx.moveTo(tableLeft + nameColW, tableTop)
  ctx.lineTo(tableLeft + nameColW, y)
  ctx.moveTo(tableLeft + nameColW + shiftColW, tableTop)
  ctx.lineTo(tableLeft + nameColW + shiftColW, y)
  ctx.strokeStyle = '#e5e7eb'
  ctx.stroke()

  return canvas.toDataURL('image/png')
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',')
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new File([u8arr], filename, { type: mime })
}

// ─── Modal de compartilhamento da agenda via WhatsApp (imagem + texto) ────────
function ShareScheduleModal({ imageDataUrl, text, onClose }: { imageDataUrl: string; text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const canNativeShare = typeof navigator !== 'undefined' && !!(navigator as any).share

  const downloadImage = () => {
    const a = document.createElement('a')
    a.href = imageDataUrl
    a.download = 'agenda-semanal.png'
    a.click()
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const nativeShare = async () => {
    try {
      const file = dataUrlToFile(imageDataUrl, 'agenda-semanal.png')
      const shareData: any = { text, files: [file] }
      if ((navigator as any).canShare && !(navigator as any).canShare(shareData)) {
        // Fallback: compartilha só o texto se o navegador não aceitar arquivo
        await (navigator as any).share({ text })
        return
      }
      await (navigator as any).share(shareData)
    } catch {}
  }

  const openWhatsapp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Enviar agenda via WhatsApp</h3>
            <p className="text-xs text-gray-500 mt-0.5">Imagem + texto prontos para compartilhar</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={16}/></button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageDataUrl} alt="Prévia da agenda semanal" className="w-full h-auto" />
          </div>

          {canNativeShare ? (
            <button onClick={nativeShare}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
              <MessageCircle size={15}/> Compartilhar imagem + texto
            </button>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
              Seu navegador não permite anexar a imagem automaticamente ao WhatsApp. Baixe a imagem abaixo e anexe manualmente junto com o texto copiado.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={downloadImage}
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Copy size={14}/> Baixar imagem
            </button>
            <button onClick={copyText}
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Copy size={14}/> {copied ? 'Texto copiado!' : 'Copiar texto'}
            </button>
          </div>

          <button onClick={openWhatsapp}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100">
            Abrir WhatsApp com o texto
          </button>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de nova alocação ────────────────────────────────────────────────────
function AddModal({ userId, shift, weekStart, dayOffset, onClose }: {
  userId: string; shift: any; weekStart: string; dayOffset: number; onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: projectsData } = useQuery({ queryKey:['projects-all'], queryFn:()=>projectsApi.list({size:100}) })
  const { data: clients=[] } = useQuery({ queryKey:['clients'], queryFn: clientsApi.list })
  const [projectId, setProjectId] = useState('')
  const [actType, setActType] = useState('implantacao')
  const projects = projectsData?.items || []

  // Calcula a data exata do dia clicado
  const dayDate = format(addDays(new Date(weekStart + 'T12:00:00'), dayOffset), 'yyyy-MM-dd')

  const add = useMutation({
    mutationFn: () => scheduleApi.create({
      user_id: userId,
      project_id: projectId,
      week_start: weekStart,
      shift: shift.key,
      day: dayDate,
      activity_type: actType,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule'] }); onClose() },
  })

  const dayName = WEEK_DAYS[dayOffset]?.label || ''

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Nova alocação</h3>
            <p className="text-xs text-gray-500 mt-0.5">{shift.emoji} {shift.label} · {dayName} {dayDate}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={16}/></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Projeto</label>
            <select value={projectId} onChange={e=>setProjectId(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white">
              <option value="">Selecione um projeto...</option>
              {projects.map((p:any) => {
                const c = (clients as any[]).find((c:any)=>c.id===p.client_id)
                return <option key={p.id} value={p.id}>{c?.name||'—'} — {p.name}</option>
              })}
            </select>
            {projects.length===0 && <p className="text-xs text-amber-600 mt-1">Cadastre projetos no Dashboard primeiro.</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tipo de atividade</label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_TYPES.map(t => (
                <button key={t.value} onClick={()=>setActType(t.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${actType===t.value?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {add.isError && <p className="px-5 pb-2 text-xs text-red-600">Erro ao salvar. Tente novamente.</p>}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={()=>add.mutate()} disabled={!projectId||add.isPending}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2">
            {add.isPending && <Loader2 size={14} className="animate-spin"/>}Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Grade semanal por implantador ─────────────────────────────────────────────
function WeekGrid({ weekStart, selectedUserId }: { weekStart: string; selectedUserId: string }) {
  const qc = useQueryClient()
  const { data: users=[], isLoading: loadingUsers } = useQuery({ queryKey:['users'], queryFn: usersApi.list })
  const { data: schedule={}, isLoading: loadingSched } = useQuery({
    queryKey: ['schedule', weekStart],
    queryFn: () => scheduleApi.getWeek(weekStart)
  })
  const { data: clients=[] } = useQuery({ queryKey:['clients'], queryFn: clientsApi.list })

  const [modal, setModal] = useState<{ userId: string; shift: any; dayOffset: number } | null>(null)
  const [shareModal, setShareModal] = useState<{ imageDataUrl: string; text: string } | null>(null)

  const del = useMutation({
    mutationFn: (id: string) => scheduleApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule', weekStart] })
  })

  const prevWeek = format(subWeeks(new Date(weekStart + 'T12:00:00'), 1), 'yyyy-MM-dd')
  const clone = useMutation({
    mutationFn: () => scheduleApi.cloneWeek({ source_week: prevWeek, target_week: weekStart }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule', weekStart] })
  })

  const filteredUsers = selectedUserId === 'all'
    ? (users as any[])
    : (users as any[]).filter((u: any) => u.id === selectedUserId)

  // Datas dos dias da semana
  const weekDates = WEEK_DAYS.map(d => ({
    ...d,
    date: addDays(new Date(weekStart + 'T12:00:00'), d.key),
    dateStr: format(addDays(new Date(weekStart + 'T12:00:00'), d.key), 'dd/MM'),
  }))

  const isToday = (dayOffset: number) => {
    const d = addDays(new Date(weekStart + 'T12:00:00'), dayOffset)
    return format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  }

  return (
    <div>
      {/* Botões de ação */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => clone.mutate()} disabled={clone.isPending}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
          {clone.isPending ? <Loader2 size={14} className="animate-spin"/> : <Copy size={14}/>}
          Clonar semana anterior
        </button>
        {clone.isSuccess && <span className="text-xs text-green-600">{(clone.data as any)?.message}</span>}

        <button
          onClick={() => {
            const text = buildWhatsappScheduleText({ users: filteredUsers as any[], schedule: schedule as any, clients: clients as any[], weekStart })
            const imageDataUrl = buildScheduleImageDataUrl({ users: filteredUsers as any[], schedule: schedule as any, clients: clients as any[], weekStart })
            if (imageDataUrl) setShareModal({ imageDataUrl, text })
            else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-green-700 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100">
          <MessageCircle size={14}/>
          Enviar agenda via WhatsApp
        </button>
      </div>

      {(loadingUsers || loadingSched) ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500"/></div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cadastre implantadores em Configurações.</div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user: any) => {
            const userAllocs = (schedule as any)[user.id] || {}

            return (
              <div key={user.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Header do implantador */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {getInitials(user.name)}
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{user.name}</span>
                  <span className="text-xs text-gray-400 capitalize ml-1">({user.role})</span>
                  {/* Contagem de alocações na semana */}
                  <span className="ml-auto text-xs text-gray-400">
                    {['manha','tarde'].flatMap(sh => [...(userAllocs[sh]||[])]).length} alocações
                  </span>
                </div>

                {/* Grade dias × turnos */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[700px]">
                    <thead>
                      <tr>
                        {/* Coluna de turno */}
                        <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-400 border-b border-gray-100"></th>
                        {weekDates.map(day => (
                          <th key={day.key} className={`px-2 py-2 text-center border-b border-gray-100 ${isToday(day.key) ? 'bg-blue-50' : ''}`}>
                            <div className={`text-xs font-semibold ${isToday(day.key) ? 'text-blue-600' : 'text-gray-600'}`}>{day.label}</div>
                            <div className={`text-xs ${isToday(day.key) ? 'text-blue-500' : 'text-gray-400'}`}>{day.dateStr}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SHIFTS.map(shift => (
                        <tr key={shift.key} className="border-t border-gray-100">
                          {/* Label do turno */}
                          <td className={`px-3 py-2 ${shift.bg}`}>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${shift.badge}`}>
                              {shift.emoji} {shift.label}
                            </span>
                          </td>
                          {/* Células de cada dia */}
                          {weekDates.map(day => {
                            // Filtra alocações do turno pelo dia específico
                            const dayStr = format(addDays(new Date(weekStart + 'T12:00:00'), day.key), 'yyyy-MM-dd')
                            const items = (userAllocs[shift.key] || []).filter((a: any) => (a.day || a.week_start) === dayStr)

                            return (
                              <td key={day.key} className={`px-2 py-2 align-top border-l border-gray-100 min-w-[130px] ${isToday(day.key) ? 'bg-blue-50/30' : ''}`}>
                                <div className="space-y-1 min-h-[48px]">
                                  {items.map((a: any, ai: number) => {
                                    const proj = a.project || {}
                                    const client = (clients as any[]).find((c: any) => c.id === proj.client_id)
                                    return (
                                      <div key={a.id} className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs ${COLORS[ai % COLORS.length]}`}>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold truncate">{client?.name || proj.name || '?'}</p>
                                          <p className="opacity-60 truncate capitalize text-[10px]">{a.activity_type}</p>
                                        </div>
                                        <button onClick={() => del.mutate(a.id)}
                                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 rounded transition-all flex-shrink-0">
                                          <X size={10}/>
                                        </button>
                                      </div>
                                    )
                                  })}
                                  <button
                                    onClick={() => setModal({ userId: user.id, shift, dayOffset: day.key })}
                                    className="w-full flex items-center justify-center py-1 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-lg text-xs gap-1 transition-colors border border-dashed border-transparent hover:border-gray-200">
                                    <Plus size={11}/>
                                  </button>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <AddModal
          userId={modal.userId}
          shift={modal.shift}
          weekStart={weekStart}
          dayOffset={modal.dayOffset}
          onClose={() => setModal(null)}
        />
      )}

      {shareModal && (
        <ShareScheduleModal
          imageDataUrl={shareModal.imageDataUrl}
          text={shareModal.text}
          onClose={() => setShareModal(null)}
        />
      )}
    </div>
  )
}

// ─── Visão Mensal ─────────────────────────────────────────────────────────────
function MonthView({ selectedUserId }: { selectedUserId: string }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const qc = useQueryClient()
  const { data: users=[] } = useQuery({ queryKey:['users'], queryFn: usersApi.list })
  const { data: clients=[] } = useQuery({ queryKey:['clients'], queryFn: clientsApi.list })

  const start = startOfMonth(currentMonth)
  const end = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start, end })
  const weekStarts = [...new Set(days.map(d => format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')))]
  const weekQueries = weekStarts.map(ws => useQuery({ queryKey: ['schedule', ws], queryFn: () => scheduleApi.getWeek(ws) }))
  const del = useMutation({ mutationFn: (id: string) => scheduleApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }) })

  const allByUserDateShift: Record<string, Record<string, Record<string, any[]>>> = {}
  weekQueries.forEach((q, qi) => {
    if (!q.data) return
    Object.entries(q.data as Record<string, any>).forEach(([userId, shifts]: any) => {
      if (!allByUserDateShift[userId]) allByUserDateShift[userId] = {}
      const ws = weekStarts[qi]
      eachDayOfInterval({ start: new Date(ws + 'T12:00:00'), end: addWeeks(new Date(ws + 'T12:00:00'), 1) })
        .slice(0, 7).forEach(day => {
          if (!isSameMonth(day, currentMonth)) return
          const dk = format(day, 'yyyy-MM-dd')
          if (!allByUserDateShift[userId][dk]) allByUserDateShift[userId][dk] = { manha: [], tarde: [] }
          ;['manha', 'tarde'].forEach(sh => {
            if (shifts[sh]) {
              // Push only allocations that match the exact day (or fallback to week_start if `day` missing)
              const matched = (shifts[sh] as any[]).filter(a => (a.day || a.week_start) === dk)
              allByUserDateShift[userId][dk][sh].push(...matched)
            }
          })
        })
    })
  })

  const filteredUsers = selectedUserId === 'all' ? (users as any[]) : (users as any[]).filter((u: any) => u.id === selectedUserId)
  const startDay = getDay(start) === 0 ? 6 : getDay(start) - 1
  const padded = [...Array(startDay).fill(null), ...days]
  const WD = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  const isLoading = weekQueries.some(q => q.isLoading)

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><ChevronLeft size={18}/></button>
        <span className="text-sm font-medium text-gray-700 min-w-[150px] text-center capitalize">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</span>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><ChevronRight size={18}/></button>
      </div>
      {isLoading ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500"/></div>
      : filteredUsers.length === 0 ? <div className="text-center py-16 text-gray-400 text-sm">Nenhum implantador. Cadastre em Configurações.</div>
      : <div className="space-y-5">
          {filteredUsers.map((user: any) => (
            <div key={user.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-semibold">{getInitials(user.name)}</div>
                <div><p className="text-sm font-semibold text-gray-800">{user.name}</p><p className="text-xs text-gray-400 capitalize">{user.role}</p></div>
                <div className="ml-auto flex items-center gap-3 text-xs">
                  <span className="text-amber-600">🌅 Manhã</span>
                  <span className="text-orange-600">☀️ Tarde</span>
                </div>
              </div>
              <div>
                <div className="grid grid-cols-7 border-b border-gray-100">
                  {WD.map(d => <div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>)}
                </div>
                <div className="grid grid-cols-7">
                  {padded.map((day, i) => {
                    const dk = day ? format(day, 'yyyy-MM-dd') : null
                    const isToday = dk === format(new Date(), 'yyyy-MM-dd')
                    const da = dk ? (allByUserDateShift[user.id]?.[dk] || { manha: [], tarde: [] }) : null
                    const mu = da ? [...new Map(da.manha.map((a: any) => [a.project_id, a])).values()] : []
                    const tu = da ? [...new Map(da.tarde.map((a: any) => [a.project_id, a])).values()] : []
                    return (
                      <div key={i} className={`min-h-[80px] p-1.5 border-r border-b border-gray-100 ${!day ? 'bg-gray-50/50' : ''}`}>
                        {day && <>
                          <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 ${isToday ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>{format(day, 'd')}</div>
                          <div className="space-y-0.5">
                            {mu.slice(0, 1).map((a: any, ai: number) => { const p = a.project || {}; const c = (clients as any[]).find((c: any) => c.id === p.client_id); return (
                              <div key={a.id + '-m'} className={`group flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${COLORS[ai % COLORS.length]}`}>
                                <span className="text-[9px]">🌅</span><span className="truncate">{c?.name || p.name || '?'}</span>
                                <button onClick={() => del.mutate(a.id)} className="opacity-0 group-hover:opacity-100 ml-auto"><X size={9}/></button>
                              </div>
                            )})}
                            {tu.slice(0, 1).map((a: any, ai: number) => { const p = a.project || {}; const c = (clients as any[]).find((c: any) => c.id === p.client_id); return (
                              <div key={a.id + '-t'} className={`group flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${COLORS[(ai + 3) % COLORS.length]}`}>
                                <span className="text-[9px]">☀️</span><span className="truncate">{c?.name || p.name || '?'}</span>
                                <button onClick={() => del.mutate(a.id)} className="opacity-0 group-hover:opacity-100 ml-auto"><X size={9}/></button>
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

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedUserId, setSelectedUserId] = useState('all')
  const weekStart = format(currentWeek, 'yyyy-MM-dd')
  const { data: users=[] } = useQuery({ queryKey:['users'], queryFn: usersApi.list })

  return (
    <div className="max-w-full px-6 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gestão de Agenda</h1>
          <p className="text-sm text-gray-500 mt-0.5">Alocação operacional da equipe</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filtro de implantador */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <User size={15} className="text-gray-400"/>
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="text-sm text-gray-700 focus:outline-none bg-transparent">
              <option value="all">Todos os implantadores</option>
              {(users as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Nav da semana */}
          {view === 'week' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentWeek(w => subWeeks(w, 1))} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><ChevronLeft size={18}/></button>
              <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
                {format(currentWeek, "'Semana de' dd/MM", { locale: ptBR })} — {format(addDays(currentWeek, 4), 'dd/MM/yyyy')}
              </span>
              <button onClick={() => setCurrentWeek(w => addWeeks(w, 1))} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><ChevronRight size={18}/></button>
            </div>
          )}

          {/* Toggle visão */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView('week')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view==='week'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>Semanal</button>
            <button onClick={() => setView('month')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view==='month'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>Mensal</button>
          </div>
        </div>
      </div>

      {view === 'week'
        ? <WeekGrid weekStart={weekStart} selectedUserId={selectedUserId}/>
        : <MonthView selectedUserId={selectedUserId}/>
      }
    </div>
  )
}
