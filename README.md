# Implantação Platform

Plataforma enterprise para **gestão de projetos de implantação** e **alocação semanal de equipes**.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Python 3.12 + FastAPI + SQLModel |
| Banco de dados | PostgreSQL 16 + Alembic |
| Cache / Filas | Redis 7 |
| Workers | Celery + APScheduler |
| Frontend | Next.js 14 + Tailwind + ShadCN |
| Auth | JWT (access + refresh tokens) |
| Infra | Docker Compose |

---

## Início rápido

```bash
# 1. Clonar e subir infraestrutura
git clone <repo>
cd implantacao-platform
docker compose up -d

# 2. Rodar migrations
docker exec implantacao_api alembic upgrade head

# 3. Criar organização e admin inicial
docker exec implantacao_api python -m app.scripts.seed

# Acessar
# API: http://localhost:8000/docs
# App: http://localhost:3000
```

---

## Migrações e alterações recentes

- Adicionado o campo `day` em `allocations` para suportar alocações por dia (antes eram apenas por `week_start`).

- Arquivos importantes criados/alterados:
	- [backend/migrations/versions/0001_add_allocations_day.py](backend/migrations/versions/0001_add_allocations_day.py) — migration que adiciona a coluna `day`.
	- [backend/migrations/env.py](backend/migrations/env.py) — ambiente Alembic (simplificado).
	- [backend/alembic.ini](backend/alembic.ini) — configuração mínima Alembic.
	- [backend/requirements.txt](backend/requirements.txt) — adição de `alembic` e `psycopg[binary]`.
	- [backend/app/api/v1/endpoints/schedule.py](backend/app/api/v1/endpoints/schedule.py) — aceita `day` no payload e no response.
	- [frontend/src/app/schedule/page.tsx](frontend/src/app/schedule/page.tsx) — envia `day` ao criar alocação e filtra por dia na UI.

- Comandos úteis (executar no host):

```bash
# (1) Subir infra
docker compose up -d

# (2) Se o container backend não tiver Alembic/psycopg instalados, instalar dentro do container
docker exec implantacao_api pip install -r /app/requirements.txt

# (3) Rodar migrations via Alembic (dentro do container backend). Se for preciso forçar URL sync:
docker exec -e DATABASE_URL="postgresql://implantacao:implantacao@postgres:5432/implantacao" implantacao_api alembic upgrade head

# Se a alteração já tiver sido aplicada manualmente no banco, marque a migration como aplicada:
docker exec -e DATABASE_URL="postgresql://implantacao:implantacao@postgres:5432/implantacao" implantacao_api alembic stamp head
```

- Observações:
	- No ambiente local eu já apliquei o `ALTER TABLE` diretamente e marquei a migration com `alembic stamp head` para sincronizar o histórico. Em ambientes de CI/CD recomenda-se rodar a migration via Alembic (passo 3) em vez do ALTER manual.
	- O frontend agora envia a data exata (`day`) ao criar uma alocação — se o backend receber alocações sem `day` elas continuam compatíveis (fallback para `week_start`).


---

## Estrutura de pastas

```
implantacao-platform/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # auth, projects, schedule, kpis, alerts, audit
│   │   ├── core/               # config, database, security
│   │   ├── models/             # SQLModel entities
│   │   ├── repositories/       # data access layer
│   │   ├── services/           # business logic
│   │   └── workers/            # Celery tasks + alert engine
│   ├── migrations/             # Alembic migrations
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/                # Next.js pages
│       │   ├── dashboard/      # Lista de projetos
│       │   ├── schedule/       # Grade semanal
│       │   └── executive/      # Dashboard KPIs
│       ├── components/
│       │   ├── projects/       # ProjectCard, ProjectDetails
│       │   ├── schedule/       # WeekGrid, AllocationChip
│       │   └── layout/         # AppLayout, Sidebar
│       ├── lib/                # api client, utils
│       └── types/              # TypeScript types
└── docker-compose.yml
```

---

## Perfis de acesso

| Papel | Permissões |
|---|---|
| **Administrador** | Acesso total: CRUD completo, gerenciar usuários, ver auditoria |
| **Gestor** | Criar/editar projetos, gerenciar alocações, ver KPIs |
| **Implantador** | Ver projetos, registrar atualizações, ver própria agenda |

---

## Módulos implementados

### 1. Autenticação
- Login com JWT (access + refresh token)
- Renovação automática de token no frontend
- Recuperação de senha por email
- RBAC por papel (admin / gestor / implantador)

### 2. Dashboard de Projetos
- Listagem com filtros por status, prioridade, implantador, produto, cliente
- Busca textual
- Cards expansíveis com etapas, histórico, riscos e notas
- Progress bars visuais com cores semânticas
- Indicadores de atraso e prazo próximo

### 3. Gestão Semanal
- Grade por implantador × turno (manhã / tarde / noite)
- Drag and drop de alocações (dnd-kit)
- Clonagem de semana anterior
- Detecção automática de conflitos de turno
- Indicador de sobrecarga semanal

### 4. Alertas Inteligentes
- Conflito: implantador no mesmo turno/semana em múltiplos projetos
- Sobrecarga: mais de 12 turnos na semana
- Atraso: `expected_end_date` no passado
- Estagnação: sem atualização há `ALERT_STAGNATION_DAYS` dias
- Prazo próximo: entrega em `ALERT_DEADLINE_WARNING_DAYS` dias com < 80% concluído

### 5. Dashboard Executivo
- KPIs: em andamento, concluídos no mês, atrasados, em risco, taxa média
- Gráfico de distribuição por status (PieChart)
- Gráfico de projetos por produto (BarChart)
- Lista de projetos que precisam de atenção

### 6. Auditoria
- Log automático de todas as operações críticas
- Registro de `before_data` / `after_data` em JSON
- Rastreabilidade por usuário, entidade e timestamp

---

## APIs principais

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Renovar token |
| GET | `/api/v1/projects/` | Listar projetos com filtros |
| POST | `/api/v1/projects/` | Criar projeto |
| PATCH | `/api/v1/projects/{id}` | Atualizar projeto |
| GET | `/api/v1/projects/{id}` | Detalhes completos |
| POST | `/api/v1/projects/{id}/updates` | Registrar atualização |
| GET | `/api/v1/schedule/week` | Agenda semanal |
| POST | `/api/v1/schedule/` | Criar alocação (valida conflito) |
| POST | `/api/v1/schedule/clone-week` | Clonar semana |
| GET | `/api/v1/kpis/executive` | KPIs executivos |
| GET | `/api/v1/kpis/team-capacity` | Capacidade do time |
| GET | `/api/v1/alerts/` | Alertas ativos |
| GET | `/api/v1/audit/` | Log de auditoria |

Documentação completa disponível em: `http://localhost:8000/docs`

---

## Regras de negócio

1. **Conflito de alocação**: um implantador não pode ter mais de uma alocação no mesmo turno e semana. O sistema bloqueia na criação e alerta via worker assíncrono.
2. **Status automático**: projetos com prazo vencido são marcados como `em_risco` automaticamente pelo AlertEngine.
3. **Clonagem de semana**: copia todas as alocações da semana anterior, pulando automaticamente as que geram conflito.
4. **Multitenancy**: todas as entidades carregam `org_id`, preparando expansão para múltiplas empresas.
5. **Auditoria imutável**: logs de auditoria nunca são deletados ou editados.

---

## Melhorias futuras sugeridas

- **Multitenancy completo**: row-level security no PostgreSQL por `org_id`
- **Notificações em tempo real**: WebSocket para alertas live
- **Gantt interativo**: timeline visual dos projetos
- **Integração com Google Calendar**: sync bidirecional de alocações
- **App mobile**: React Native reaproveitando a API
- **Relatórios em PDF**: exportação de status semanal e mensal
- **SSO/SAML**: autenticação federada para enterprise
- **SLA tracking**: monitoramento de tempo por etapa
- **Previsão de capacidade**: ML para estimar demanda futura
