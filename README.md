# Monitora Deltaville — v5.1.0

Versão de estabilização do dashboard comunitário, com redesign responsivo para desktop/mobile e tema claro/escuro.

## Estrutura

```
README.md
package.json
wrangler.jsonc
public/
```

Cloudflare Workers: `npx wrangler deploy` com assets em `./public`.

As alterações desta versão estão descritas em [CHANGELOG.md](CHANGELOG.md). O backend usa as funções em `supabase/functions` e a migração aditiva em `supabase/sql/stabilization-v5.1.0.sql`.

