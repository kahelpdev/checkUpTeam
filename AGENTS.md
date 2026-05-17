<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Regras obrigatórias para todos os agentes

## Deploy — LEIA ANTES DE QUALQUER ALTERAÇÃO

**Toda alteração de código OBRIGATORIAMENTE deve ser seguida de deploy em produção.**

Não existe "alterei o código mas não fiz deploy". Toda mudança que não chega em produção é trabalho incompleto.

O processo completo de deploy está documentado em [`DEPLOY.md`](./DEPLOY.md).

### Resumo do fluxo obrigatório após cada alteração:

1. `npm run build` — build deve passar sem erros
2. `git add` + `git commit` + `git push origin master`
3. Upload dos arquivos alterados para a VPS via SFTP: `/opt/checkupteam/src/`
4. `docker build -t checkupteam:latest .` na VPS
5. `docker restart checkupteam`
6. Verificar: `curl -sk -o /dev/null -w "%{http_code}" https://checkupteam.online/login` → deve retornar `200`

### Credenciais VPS
```
HOST: 147.93.9.236  |  USER: root  |  PORT: 22
```
Senha e demais detalhes em `DEPLOY.md`.

## Proibições absolutas

- ❌ Nunca usar a Coolify UI para deploy (causa falha no health check)
- ❌ Nunca fazer `git push --force` no master sem criar branch de backup antes
- ❌ Nunca alterar os labels Traefik do container `checkupteam`
- ❌ Nunca parar o container `lynfcxughmyp0kusdy4t7dcw` (é o PostgreSQL)
- ❌ Nunca misturar código do SprintFlow neste repositório
