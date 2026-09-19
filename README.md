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

O Monitora usa **Leaflet + CRS.Simple** com o arquivo local:

`public/assets/mapa-deltaville-master.svg`

A base foi reconstruída vetorialmente a partir dos masterplans fornecidos do Deltaville atual e do Deltaville Marine, usando a foto aérea como referência de orientação.

- Sem Google Maps.
- Sem API key.
- Sem cartão/faturamento.
- Sem tiles externos.
- Funciona como asset local do PWA e pode ser armazenado em cache.
- Ocorrências e seleção de trechos continuam como camadas interativas independentes.

Os registros antigos continuam usando o sistema legado `map_x/map_y`; o app aplica uma transformação de compatibilidade para posicioná-los no mapa mestre.
