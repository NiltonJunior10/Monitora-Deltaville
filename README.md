# Monitora Deltaville — v6.9.0

Dashboard comunitário responsivo com interface mobile e web em linguagem visual iOS 27, tema claro/escuro e monitoramento climático local.

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


## Camada de vias — v7.0.56

`public/road-network.js` contém 97 traçados em pixels da imagem **1601 × 982** usada pelo aplicativo. As pistas das avenidas são separadas; as vias internas de Brisas, Costa do Sol, Blue, Acqua, Garden e Sunset permitem selecionar pontos. Os nomes das vias internas indicam o condomínio, sem atribuir nomes oficiais não verificados. O filtro “Vias” mostra a malha; “Alertas” mantém somente as camadas de ocorrências.

A seleção de trechos continua nas avenidas cadastradas. As ruas internas e a via perimetral usam o registro existente de ponto exato e `custom_location`, sem criar IDs de locais no banco. Coordenadas normalizadas e dados já salvos permanecem compatíveis. Os traçados antigos são mantidos exclusivamente para interpretar os `routeKey` e as proporções dos trechos legados; corrigi-los automaticamente deslocaria relatos antigos. Novas seleções usam chaves versionadas de pista.

Os vértices foram traçados sobre a arte local e revisados visualmente. **Não constituem levantamento topográfico, georreferenciamento ou garantia de cobertura/precisão de 100%.** A imagem comercial da Ábaco e a captura de satélite têm enquadramentos e proporções diferentes. Não inserir latitude/longitude no CRS.Simple nem apresentar coordenadas em pixels como GeoJSON geográfico.

Para precisão geográfica, obter a planta CAD/GIS ou ortofoto georreferenciada e vetorializar as vias, validar em campo e publicar uma camada GeoJSON WGS84. Leaflet suporta essa camada, mas migrar os relatos atuais exige pontos de controle, avaliação de erro e uma transformação explícita. OSM pode ajudar como base inicial, sujeito a cobertura e validação das ruas internas.

Validação: `node --test tests/*.test.cjs` e `npm run check`. Os testes da malha cobrem pistas separadas, exclusão de canteiros/lago/lazer, compatibilidade de trechos antigos e cache offline. O teste de release passa a comparar a interface com package.json, eliminando a expectativa obsoleta fixa em 5.1.2.
