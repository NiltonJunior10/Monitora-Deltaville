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



## Mapa estático local

O Monitora usa **Leaflet + CRS.Simple** com os arquivos locais:

- `public/assets/mapa-deltaville-clean.webp`
- `public/assets/mapa-entorno-fade.webp`

O mapa usa o sistema original 1601×982, mantendo compatibilidade direta com `map_x/map_y`, seleção de trechos, pontos e ocorrências.

- Sem Google Maps.
- Sem API key.
- Sem cartão/faturamento.
- Sem tiles externos.
- Funciona como asset local do PWA e pode ser armazenado em cache.
- Avenidas, lagos, rio e ocorrências continuam como camadas interativas sobre a arte.

