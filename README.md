# Monitora Deltaville

Projeto web/PWA do Monitora Deltaville.

## Cloudflare
Este repositório está preparado para publicar no Worker existente:

`weathered-cell-dcbd`

### Estrutura
- `public/` — arquivos do aplicativo
- `wrangler.jsonc` — configuração do Worker
- `package.json` — dependência do Wrangler

### Cloudflare Builds
- Build command: deixe vazio
- Deploy command: `npx wrangler deploy`
- Production branch: `main`
- Root directory: `/`
