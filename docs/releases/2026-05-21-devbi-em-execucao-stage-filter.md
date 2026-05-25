# DevBI — Seção "Em Execução Agora" agora respeita o filtro de stage

**Data:** 2026-05-21
**Tipo:** Bug fix + nova configuração
**Telas afetadas:** `/devbi`, `/api-manager`
**PRs:** [#3](https://github.com/kahelpdev/checkUpTeam/pull/3), [#4](https://github.com/kahelpdev/checkUpTeam/pull/4)

## O que mudou

- A seção **Em Execução Agora** do DevBI antes mostrava qualquer card ativo (incluindo "Concluído", "Novo", etc.). Agora mostra **apenas** cards nas stages configuradas como "em execução".
- O título passou a exibir a contagem real: `Em Execução Agora — N em execução`.
- O subtítulo mostra explicitamente quais stages estão sendo filtradas: `(filtrado por: Em Execução)`.
- Quando ninguém está em execução, o painel mostra um estado vazio claro com as stages monitoradas E as stages disponíveis no momento para o time.
- Nova seção no `/api-manager`: **"Stages 'Em Execução' do DevBI"** — permite adicionar/remover as stages que contam como "em execução", sem precisar fazer deploy.

## Antes vs. Depois

**Antes:** o DevBI mostrava cards como "Administrador / Concluído / há 27 dias" no painel "Em Execução Agora", distorcendo a visão de carga real.

**Depois:** apenas membros com tarefa em stages configuradas (default: `["Em Execução"]`) aparecem no painel. Os números batem com o Kanban do CardsFlow.

## Como usar (para você que é líder/diretor)

1. Vá em `/api-manager`.
2. Procure a seção **"Stages 'Em Execução' do DevBI"**.
3. Adicione as stages do CardsFlow que devem aparecer no painel (cada equipe pode ter nomes diferentes).
4. Clique **Salvar**.
5. Abra `/devbi`, selecione a equipe e clique **Atualizar**.

> Se o DevBI ficar vazio depois de configurar, o próprio painel mostra as stages disponíveis no CardsFlow para a equipe selecionada — basta copiar a string exata (com aspas, espaços e acentos) e colar na configuração.

## Como verificar a correção

1. Selecione uma equipe no `/devbi`.
2. Conte quantos cards estão na coluna "Em Execução" (ou equivalente) no Kanban do CardsFlow para essa equipe.
3. Compare com a contagem do painel "Em Execução Agora" do DevBI.
4. Os números devem bater.

## Notas

- **Limitação conhecida:** a configuração de stages é **global**. Se equipes diferentes precisarem de filtros diferentes (ex: time A usa "Em Execução" e time B usa "Em Desenvolvimento"), hoje você precisa cadastrar todas as variações.
- **Multi-team:** o filtro funciona corretamente independente da equipe selecionada.
- **Compatibilidade:** Dashboard, Tasks e Reprova continuam com comportamento inalterado.
