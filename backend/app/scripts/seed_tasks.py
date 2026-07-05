"""
Popula os clientes e as tarefas operacionais já levantadas no painel de gestão
multi-cliente (AM Farma, Rede Pharma, Provix, etc.).

Uso:
    docker exec implantacao_api python -m app.scripts.seed_tasks

É idempotente: rodar de novo não duplica clientes nem tarefas (a checagem de
tarefa é por client_id + title dentro da mesma org).
"""
import asyncio
import sys
from datetime import date

sys.path.insert(0, '/app')

CLIENTS = [
    "AM Farma", "Açaí Belo Norte", "Animale", "Independente", "Rede Pharma",
    "Nazaria", "Provix", "Economia Farma", "Prohospital", "Ágil Marinho",
    "Procfit (Interno)",
]

TASKS = [
    # (cliente, título, descrição, status, impacto, is_blocker, responsável, aguardando_de, due_note, escalar, motivo_escalação)
    ("AM Farma", "Manter controle de Gaps e pendências de Dev",
     "Todos os gaps e pendências de desenvolvimento são controlados na planilha \"Preparação - Go Live\".",
     "em_andamento", "alto", False, "Raquel", None, "Contínuo", False, None),
    ("AM Farma", "Criar planilha de demandas impeditivas (cliente x sistema)",
     "Colunas: Atividade, Detalhamento, Status, Deadline, Critério de Validação. Cruzar o que o cliente considera "
     "impeditivo para o Go-Live com o que a Procfit também considera impeditivo.",
     "a_fazer", "critico", True, "Raquel", None, None, True,
     "Alinhar critério de \"impeditivo\" com o gestor antes de compartilhar com o cliente."),
    ("AM Farma", "Reestruturar cronograma macro", None, "a_fazer", "alto", False, "Raquel", None, None, False, None),
    ("AM Farma", "Reunião com Victor de Paula - cobrar Gaps de Dev do PDV",
     "Cobrar entrega dos gaps de desenvolvimento do PDV e solicitar nova demanda: agrupamento de itens no cupom.",
     "a_fazer", "alto", False, "Raquel", "Victor de Paula", "Agendar", False, None),
    ("AM Farma", "PDV Prevendas - aguardar homologação",
     "Versão do PDV de Prevendas está pendente; cliente precisa dar o OK da homologação.",
     "aguardando_terceiro", "alto", True, "Raquel", "Cliente (AM Farma)", None, False, None),
    ("AM Farma", "Checkout Automático - autorização",
     "Victor de Paula vai buscar autorização do Filipe Oliveira sobre o assunto.",
     "aguardando_terceiro", "medio", False, "Victor de Paula", "Filipe Oliveira", None, False, None),
    ("AM Farma", "Etiquetas de Gôndola - finalizar formulário",
     "Lucas deve finalizar o formulário; o cliente trata esse item como impeditivo.",
     "em_andamento", "critico", True, "Lucas", None, None, True,
     "Item classificado como impeditivo pelo cliente; cobrar prazo de conclusão."),
    ("AM Farma", "Emissão de boletos Itaú",
     "Iago deve cobrar o cliente sobre esse assunto e demais pendências do financeiro.",
     "aguardando_terceiro", "medio", False, "Iago", "Cliente (AM Farma)", None, False, None),
    ("AM Farma", "Alinhar com Saulo sobre Imendes/Tributário",
     "Falar com Saulo sobre Imendes e buscar informações sobre o tributário.",
     "a_fazer", "medio", False, "Raquel", "Saulo", None, False, None),
    ("AM Farma", "Reforçar atenção do time no grupo com o cliente",
     "Lembrete recorrente para todo o time manter atenção às mensagens do grupo.",
     "monitoramento", "medio", False, "Time", None, "Recorrente", False, None),
    ("AM Farma", "Lucas - acompanhamento do suporte no grupo",
     "Lucas deve acompanhar todo suporte feito no grupo, no mesmo padrão que o Paulo já faz.",
     "a_fazer", "medio", False, "Lucas", None, None, False, None),
    ("AM Farma", "Visita presencial à AM Farma",
     "Visita presencial agendada para acompanhar o andamento do Go-Live in loco.",
     "a_fazer", "alto", False, "Raquel", None, "06/07/2026", False, None),

    ("Açaí Belo Norte", "Manter controle de Gaps e melhorias",
     "Pendências de implantação controladas na planilha Excel \"Gaps e melhorias\".",
     "em_andamento", "medio", False, "Raquel / Lucas", None, "Contínuo", False, None),
    ("Açaí Belo Norte", "Realizar hand-over para o suporte", None, "a_fazer", "alto", False, "Raquel", None, None, False, None),
    ("Açaí Belo Norte", "Refazer deadline das pendências",
     "Lucas deve refazer o deadline das pendências, pois o prazo já está atrasado.",
     "atrasado", "critico", True, "Lucas", None, "URGENTE", True, "Prazo já estourado."),
    ("Açaí Belo Norte", "Criar planilha de impeditivos (mesma estrutura do AM Farma)",
     None, "a_fazer", "alto", True, "Raquel", None, None, False, None),

    ("Animale", "Levantar requisitos de implantação",
     "Definir carga de produtos, vendas, estoque, DNA de precificação, o que será migrado primeiro, quais tickets "
     "abrir, certificados e demais itens.", "a_fazer", "alto", False, "Raquel", None, None, False, None),
    ("Animale", "Agendar DNA da operação do cliente",
     "Filipe deve marcar reunião de DNA para mapear a operação do cliente.",
     "a_fazer", "alto", False, "Filipe", None, None, False, None),
    ("Animale", "Organizar estrutura geral do projeto",
     "Projeto ainda no início, precisa de organização geral.", "a_fazer", "alto", False, "Raquel", None, None, False, None),

    ("Independente", "Implantar EDI de Troca de Arquivos", None, "a_fazer", "alto", False, "Raquel", None, None, False, None),
    ("Independente", "Preparar tributário em aberto para o Imendes", None, "a_fazer", "medio", False, "Raquel", None, None, False, None),
    ("Independente", "Acompanhamento geral do cliente",
     "Cliente contrata período todos os dias úteis da semana; nível de atenção moderado.",
     "monitoramento", "medio", False, "Raquel", None, "Contínuo", False, None),
    ("Independente", "Ticket #418300 - follow-up de conclusão",
     "Cobrar a conclusão do ticket #418300 junto à Nadja.",
     "aguardando_terceiro", "medio", False, "Raquel", "Nadja", None, False, None),

    ("Rede Pharma", "Finalizar pendências do módulo tributário",
     "Cliente difícil, processo sempre volta para alinhamento. Há demandas do financeiro que dependem da "
     "conclusão do tributário.", "em_andamento", "critico", True, "Raquel", None, None, True,
     "Bloqueia entrega das demandas do financeiro; cliente historicamente resistente a alinhamentos."),
    ("Rede Pharma", "Reincidência de Estoque Picking Negativo",
     "Problema de estoque com picking negativo voltou a ocorrer; aguardando retorno de Claiton para reincidência.",
     "aguardando_terceiro", "critico", True, "Raquel", "Claiton", "Cobrar retorno", True,
     "Reincidência de problema já tratado anteriormente; risco de voltar a impactar o estoque do cliente."),
    ("Rede Pharma", "Integração CT-e",
     "Implantação da integração de CT-e (Conhecimento de Transporte eletrônico); ainda pendente de início.",
     "a_fazer", "alto", False, "Raquel", None, "Definir início", False, None),
    ("Rede Pharma", "E-commerce - vínculo vendedor/comissão",
     "Planejar o vínculo entre vendedor e comissão no módulo de E-commerce.",
     "a_fazer", "medio", False, "Raquel", None, None, False, None),
    ("Rede Pharma", "PDV - FP_ESTORNO",
     "Ajuste no PDV relacionado à forma de pagamento FP_ESTORNO.",
     "aguardando_terceiro", "alto", False, "Raquel", "Victor de Paula", "Cobrar retorno", False, None),

    ("Nazaria", "Acompanhamento padrão", "Cliente já possui profissional dedicado.",
     "monitoramento", "baixo", False, "Profissional dedicado", None, "Contínuo", False, None),

    ("Provix", "Acompanhar implantação de WMS",
     "Revisar periodicamente o status do processo de implantação de WMS.",
     "em_andamento", "medio", False, "Profissional dedicado (3x/semana)", None, "Recorrente", False, None),
    ("Provix", "Definir quem fará a visita presencial de quarta-feira",
     "Além do profissional dedicado, é necessária uma visita presencial na quarta-feira; alinhar quem irá.",
     "a_fazer", "medio", False, "A definir", None, "Quarta-feira (08/07)", False, None),

    ("Economia Farma", "Monitorar saída do PBS local do processo",
     "Cliente quer retirar o PBS local do processo; manter no radar de acompanhamento.",
     "monitoramento", "medio", False, "Raquel", None, "Contínuo", False, None),

    ("Prohospital", "Definir responsável pela consultoria dedicada",
     "Cliente tem consultoria dedicada 2 dias por semana; precisa definir quem cumprirá essa agenda.",
     "a_fazer", "medio", False, "Raquel / Gestor", None, None, True,
     "Depende de alocação de time; decisão passa pelo gestor."),

    ("Ágil Marinho", "Apoio à homologação de melhorias",
     "Cliente está homologando melhorias; necessário apoio de baixa intensidade.",
     "em_andamento", "baixo", False, "Raquel", None, "Contínuo", False, None),

    ("Procfit (Interno)", "Importar Plano de Contas Domínio para o Procfit",
     "Importação do Plano de Contas do sistema Domínio para a base do Procfit.",
     "a_fazer", "medio", False, "Raquel", None, None, False, None),
    ("Procfit (Interno)", "Formalizar apontamentos pendentes (29/06 a 03/07)",
     "Registrar no Cosmos Pro os apontamentos pendentes desse período seguindo a estrutura padrão "
     "(Atividade, Problema, Causa, Ação, Status, Próximo Passo, Horas).",
     "atrasado", "alto", False, "Raquel", None, "URGENTE", False, None),
]


async def seed_tasks():
    from app.core.database import AsyncSessionLocal
    from app.models.models import Organization, User, Client, Task
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        org = (await session.execute(select(Organization).limit(1))).scalars().first()
        if not org:
            print("Nenhuma organização encontrada. Rode 'python -m app.scripts.seed' primeiro.")
            return
        user = (await session.execute(select(User).where(User.org_id == org.id).limit(1))).scalars().first()
        if not user:
            print("Nenhum usuário encontrado nessa organização. Rode 'python -m app.scripts.seed' primeiro.")
            return

        client_by_name = {}
        for name in CLIENTS:
            existing = (await session.execute(
                select(Client).where(Client.org_id == org.id, Client.name == name)
            )).scalars().first()
            if existing:
                client_by_name[name] = existing
                continue
            client = Client(org_id=org.id, name=name)
            session.add(client)
            await session.flush()
            client_by_name[name] = client
        await session.commit()
        print(f"Clientes prontos: {len(client_by_name)}")

        created = 0
        for (cliente, title, desc, status, impact, is_blocker, responsible,
             waiting_on, due_note, escalate, escalation_reason) in TASKS:
            client = client_by_name[cliente]
            existing = (await session.execute(
                select(Task).where(
                    Task.org_id == org.id, Task.client_id == client.id, Task.title == title
                )
            )).scalars().first()
            if existing:
                continue
            task = Task(
                org_id=org.id,
                client_id=client.id,
                title=title,
                description=desc,
                status=status,
                impact=impact,
                is_blocker=is_blocker,
                responsible=responsible,
                waiting_on=waiting_on,
                due_note=due_note,
                escalate_to_manager=escalate,
                escalation_reason=escalation_reason,
                created_by=user.id,
            )
            session.add(task)
            created += 1
        await session.commit()
        print(f"Tarefas novas criadas: {created} (já existentes foram ignoradas).")


asyncio.run(seed_tasks())
