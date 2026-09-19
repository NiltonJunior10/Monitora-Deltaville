# v6.0.3 — Gráfico do Rio Biguaçu

- Redesenha o gráfico como área suavizada em vez de linha quebrada simples.
- Adiciona interação real por mouse, toque/arraste e teclado.
- Corrige posicionamento do tooltip, que antes podia ficar invisível ou fora do gráfico.
- Adiciona inspector com nível, horário e variação em relação à medição anterior.
- Mantém a última medição visível quando o usuário não está interagindo.
- Corrige corte de rótulos nas bordas e melhora eixos de nível/horário.
- Melhora contraste do gráfico no modo escuro.
- Mantém os filtros de 1h, 3h, 6h, 12h, 24h e 7d.
- Corrige o erro de sintaxe introduzido na ação direta de apagar ocorrência.
- Inclui river.js na verificação de sintaxe do projeto.

# v6.0.2 — Leitura, clima e exclusão

- Reforça contraste do modo escuro em textos herdados das versões anteriores.
- Corrige cores de títulos, textos secundários, formulários, cards e estados semânticos no tema escuro.
- Consolida o layout do widget de previsão do tempo para impedir sobreposição entre temperatura, chuva e resumo.
- Ajusta a previsão no mobile para quebrar o resumo em linha própria quando necessário.
- Restaura ações claras de Editar e Apagar nas ocorrências do próprio morador.
- Mantém a ação Apagar visível durante a edição no fluxo por etapas.
- Exclusão continua protegida por confirmação e limitada às ocorrências do próprio usuário.

# v6.0.1 — Correção de inicialização

- Corrige um ciclo de observação do DOM introduzido na v6 que podia bloquear o navegador durante o carregamento inicial.
- Restringe a observação dinâmica somente ao contador de alertas.
- Torna os aprimoramentos opcionais da v6 isolados: falha em um recurso visual não interrompe o app principal.
- Invalida completamente o cache v6.0.0 para impedir que navegadores continuem executando o JavaScript problemático.

# v6.0.0 — iOS 27 Futurista

- Redesenho completo da interface com foco mobile-first e aparência nativa Apple.
- Nova linguagem visual em glassmorphism, superfícies translúcidas, blur adaptativo e modo escuro refinado.
- Home reorganizada como Control Center: situação do bairro, clima, Rio Biguaçu, mapa e ocorrências com prioridade visual clara.
- Navegação mobile flutuante em frosted glass, com FAB central para registrar ocorrência.
- Acesso aos alertas movido para o topo; navegação principal passa a priorizar Início, Mapa, Relatórios e Perfil.
- Mapa passa a ser a camada predominante, com painel de detalhe em formato Bottom Sheet e gesto de swipe-down.
- Fluxo de nova ocorrência transformado em 4 etapas progressivas: tipo, local, gravidade e detalhes.
- Tipos mais comuns ficam em destaque; opções avançadas continuam disponíveis sem sobrecarregar a tela inicial do formulário.
- Login e PIN recebem apresentação mais próxima da tela de bloqueio do iPhone, com visualização por pontos e teclado numérico nativo do aparelho.
- Loading tradicional substituído visualmente por Skeleton Loader com shimmer.
- Pull-to-refresh e feedback tátil progressivo adicionados quando suportados pelo navegador.
- Large Titles passam a reduzir de tamanho durante o scroll.
- Desktop reorganizado como painel contextual, preservando mapa, rio, clima, ocorrências, relatórios e fontes de monitoramento.
- Toda a lógica existente de Supabase, autenticação, clima, Rio Biguaçu, mapa, ocorrências, fotos, realtime, push e PWA foi preservada.

# v5.2.1 — Correção do resumo desktop

- Corrige sobreposição entre “Relatos da comunidade” e “Fontes de monitoramento”.
- Divide o card de monitoramento em duas áreas internas no desktop.
- Remove alturas rígidas que cortavam conteúdo.
- Aumenta a altura das linhas de “Ocorrências recentes” e ajusta tipografia/ellipsis.
- Adapta o bloco para larguras menores de desktop sem sobreposição.

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