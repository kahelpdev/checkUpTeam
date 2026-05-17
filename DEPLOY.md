# Deploy — CheckUp Team

## Stack
- **App**: Next.js (output standalone) + Prisma + PostgreSQL
- **VPS**: Hostinger 147.93.9.236
- **Container**: Docker, gerenciado manualmente (NÃO via Coolify UI)
- **Domínio**: https://checkupteam.online
- **Proxy**: Traefik (coolify-proxy)

## Credenciais VPS
Definidas em `.env.local` (não commitado). Veja `.env.example` para os campos esperados.
```
HOST: 147.93.9.236
USER: root
PASS: (vide .env.local local — VPS_PASSWORD)
PORT: 22
```

## Fonte do projeto na VPS
```
/opt/checkupteam/
```

## Processo de deploy (passo a passo)

### 1. Build local
```bash
cd checkupteam/
npm run build
```
Build deve terminar sem erros. Verificar que `ƒ Proxy (Middleware)` aparece no output.

### 2. Commit e push para GitHub
```bash
git add <arquivos>
git commit -m "tipo: descrição"
git push origin master
```

### 3. Copiar arquivos alterados para a VPS
```bash
scp -r checkupteam/src/ root@147.93.9.236:/opt/checkupteam/src/
```

### 4. Rebuild da imagem Docker
```bash
ssh root@147.93.9.236 "cd /opt/checkupteam && docker build -t checkupteam:latest . 2>&1 | tail -5"
```

### 5. Restart do container
```bash
ssh root@147.93.9.236 "docker restart checkupteam"
```

### 6. Verificar
```bash
curl -sk -o /dev/null -w "%{http_code}" https://checkupteam.online/login
# Deve retornar: 200
```

---

## Script Python para agentes (paramiko)

```python
import paramiko

VPS_HOST = os.environ["VPS_HOST"]   # de .env.local
VPS_USER = os.environ["VPS_USER"]
VPS_PASS = os.environ["VPS_PASSWORD"]
VPS_SRC  = "/opt/checkupteam"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(VPS_HOST, port=22, username=VPS_USER, password=VPS_PASS)

# 1. Upload dos arquivos modificados via SFTP
sftp = client.open_sftp()
# Exemplo: sftp.put("src/hooks/useTeam.ts", f"{VPS_SRC}/src/hooks/useTeam.ts")
sftp.close()

# 2. Build e restart
for cmd in [
    f"cd {VPS_SRC} && docker build -t checkupteam:latest . 2>&1 | tail -5",
    "docker restart checkupteam",
    'sleep 5 && curl -sk -o /dev/null -w "%{http_code}" https://checkupteam.online/login',
]:
    stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
    print(stdout.read().decode())

client.close()
```

---

## Variáveis de ambiente do container

Valores definidos em `.env.local` (não commitado).

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string Postgres |
| `AUTH_SECRET` | Segredo do cookie de sessão (gerar com `openssl rand -base64 48`) |
| `AUTH_PASSWORD` | Senha do login admin |
| `FLOW_API_BASE_URL` | URL do ngrok da API cardsFlow |
| `FLOW_API_EMAIL` | Email de autenticação cardsFlow |
| `FLOW_API_PASSWORD` | Senha de autenticação cardsFlow |
| `TELEGRAM_BOT_TOKEN` | Token do bot de alertas |
| `TELEGRAM_CHAT_ID` | ID do chat de alertas |
| `GEMINI_API_KEY` | API key Google Gemini |

---

## REGRAS — NÃO fazer

- ❌ Deploy via Coolify UI (health check falha por timing do cert)
- ❌ `git push --force` no master sem criar backup branch antes
- ❌ Alterar os labels Traefik do container (HTTPS está funcionando)
- ❌ Parar o container `lynfcxughmyp0kusdy4t7dcw` (é o PostgreSQL do checkupteam)
- ❌ Misturar código do SprintFlow neste repositório
