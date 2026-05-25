# DevBI — Painel de Performance e Carga

## O que é

O DevBI (`/devbi`) é o painel de Business Intelligence operacional do CheckUp Team. Mostra KPIs, ranking de performance, carga de trabalho e quem está executando o quê **agora**.

## Para quem é

- **Líderes de equipe:** acompanham capacidade atual, identificam gargalos e priorizam demandas.
- **Diretoria:** decide com base em métricas de SLA, throughput e qualidade.

## Onde os dados vêm

Os dados são consumidos diretamente do **CardsFlow** em tempo real. Quando a conexão com o CardsFlow está indisponível, o DevBI mostra a última captura salva no banco local (banner amarelo no topo avisa).

## Seções da tela

### Filtros (topo)

- **Período:** intervalo de datas (`início` até `fim`). Padrão: últimos 30 dias.
- **Equipe:** dropdown com as equipes monitoradas. Configurável em `/api-manager` → "Equipes monitoradas".
- **Colaborador:** filtra ranking, workload e Em Execução por uma pessoa específica.
- **Projeto:** filtra Em Execução por projeto.
- **Atualizar:** força refresh dos dados.
- **Auto 60s:** liga refresh automático a cada 60 segundos.

### KPIs (4 cards)

- **Cards Abertos:** quantidade total de cards abertos no período.
- **Eventos Pendentes:** eventos aguardando ação.
- **SLA em Risco:** cards que vão estourar o prazo se nada mudar.
- **Resolvidos Hoje:** cards finalizados no dia.

### Entrada de Demandas (gráfico de linha)

Cards criados vs. resolvidos por dia ao longo do período. O badge no canto superior direito mostra a variação em % vs. a semana anterior.

### Em Execução Agora

**O que mostra:** apenas membros cuja tarefa atual está em uma das stages configuradas como "em execução" no CardsFlow.

- O título exibe a contagem: `Em Execução Agora — N em execução`.
- O subtítulo mostra quais stages estão sendo monitoradas: `(filtrado por: ...)`.
- Se ninguém está em execução, aparece um estado vazio com as stages monitoradas.
- Quando o DevBI fica vazio mas você espera ver pessoas: confira **quais stages estão disponíveis agora no CardsFlow** (aparecem listadas no próprio estado vazio) e ajuste a configuração no `/api-manager`.

#### Como configurar quais stages contam como "em execução"

1. Vá em `/api-manager`.
2. Seção **"Stages 'Em Execução' do DevBI"**.
3. Adicione/remova as stages via chips. Pressione Enter para adicionar.
4. Clique **Salvar**.
5. Volte ao `/devbi`, clique em **Atualizar**.

O DevBI passa a respeitar imediatamente as stages configuradas (o cache zera em até 30 segundos).

> **Importante para diretoria:** o filtro de stage é a fonte da verdade dos números visíveis aqui. Se a string da stage no CardsFlow tem espaço ou casing diferente do configurado, o DevBI não vai bater. Sempre confira o estado vazio para ver as stages disponíveis se algo parecer errado.

### Ranking de Performance

Tabela ordenada por score Kanban. Mostra QA Hit Rate, SLA %, eventos resolvidos e perfil (Ouro, Rápido, Alerta) por colaborador.

### Carga de Trabalho

Gráfico de barras horizontal com eventos ativos (azul) vs. resolvidos (verde) por pessoa.

### Detalhamento SLA e Entregas

Tabela com Fast Track, No Prazo, Atrasados e SLA % por colaborador. Útil para identificar quem está dentro/fora do prazo.

## Casos de uso típicos

| Quero saber... | Onde olho |
|---|---|
| Quem está trabalhando em quê agora? | Em Execução Agora |
| Onde estão os gargalos de capacidade? | Carga de Trabalho |
| Quem está com mais SLA estourado? | Detalhamento SLA e Entregas |
| Estamos recebendo mais ou menos demanda? | Entrada de Demandas + badge vs. semana anterior |
| Quem é o top performer do período? | Ranking de Performance |

## Perguntas Frequentes

**Por que o DevBI mostra "Ninguém está em execução no momento" se eu sei que tem gente trabalhando?**
Provavelmente as stages configuradas em `/api-manager` não batem com as strings reais do CardsFlow. Veja a lista de "Stages disponíveis agora no CardsFlow" no próprio estado vazio e ajuste.

**O número de cards do DevBI bate com o Kanban do CardsFlow?**
Deve bater. Se não bater, é porque (a) a stage configurada está com texto diferente, ou (b) o endpoint do CardsFlow está indisponível e o DevBI está usando snapshot defasado (vai aparecer um banner amarelo no topo).

**Por que vejo banner amarelo "Dados do banco local"?**
A API do CardsFlow está indisponível no momento. O DevBI está usando a última captura salva. Os dados serão atualizados automaticamente quando a conexão voltar.

**Posso ter filtros diferentes de stage por equipe?**
Hoje a configuração é global. Se você precisar filtros diferentes por equipe, abra um pedido de evolução.
