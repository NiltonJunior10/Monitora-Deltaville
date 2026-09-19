# v5.2.0 — Front-end Apple

- Reorganiza a home com hierarquia visual mais limpa no desktop e no mobile.
- Consolida tipografia com a pilha nativa Apple/SF Pro quando disponível.
- Adota superfícies neutras, cards mais leves, espaçamento consistente e azul de ação inspirado no iOS.
- Refina sidebar desktop, cabeçalho, clima, KPIs, mapa, ocorrências, módulo do Rio Biguaçu e navegação inferior.
- Preserva toda a lógica atual de autenticação, clima, rio, relatos, mapa e notificações.
- Adiciona uma camada visual final isolada em `public/apple-ui.css` para reduzir conflitos com estilos históricos.
- Atualiza cache da PWA para evitar a interface antiga após o deploy.

# v5.1.0 — Estabilização

## v5.1.2 — Interface Apple

- Adota tipografia de sistema no padrão Apple, usando SF Pro quando disponível e fallbacks nativos.
- Remove a dependência de fontes externas para manter carregamento mais rápido e consistente.
- Ajusta pesos, espaçamento e controles para uma hierarquia mais próxima do iOS.

## v5.1.1 — Tipografia

- Aumenta textos auxiliares, rótulos, cards, formulários e navegação.
- Unifica Inter para leitura e Poppins para títulos, com melhor entrelinha e contraste em tema escuro.

- Login com erro genérico, limite de tentativas atômico por unidade e IP e bloqueio progressivo. Cadastro valida PINs fracos.
- Chave privada VAPID permanece no Vault; o cliente obtém a chave pública atual e reconhece inscrições antigas.
- Sincronização do Rio Biguaçu protegida por segredo, logs válidos e UPSERT de correções posteriores da Epagri.
- Situação da comunidade separada da saúde das fontes. Rio, clima, relatos e notificações exibem estados próprios.
- Últimos dados são preservados durante falhas de rede; carregamentos independentes não apagam dados válidos.
- Ocorrências expiradas são filtradas no banco, Realtime agrupa atualizações e a variação do rio exige uma referência temporal tolerante.
- Zoom, contraste, foco de teclado, tema escuro e formulários mobile revisados.
- Núcleo testável e módulos incrementais para autenticação, rio, clima e push; cache da PWA versionado.

Validação: 10 testes locais passaram, incluindo login genérico, rate limit, sincronização protegida, UPSERT/correção, falhas independentes e estados offline. A interface foi conferida em desktop 1440×1000 e mobile 390×844 com tema escuro. Nenhum dado de produção foi criado ou apagado.

As bibliotecas externas permanecem em URLs versionadas porque o ambiente recusou o download para vendorização; a CSP limita origens e o service worker pré-carrega as versões fixadas.