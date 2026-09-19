# v6.3.1 — Correção dos tiles do mapa real

- Corrige o mapa branco observado no iPhone.
- Troca a camada principal por CARTO Light baseada em dados OpenStreetMap.
- Adiciona fallback automático para tiles diretos do OpenStreetMap se a camada principal falhar.
- Remove cross-origin forçado que podia impedir imagens de tiles em alguns contextos mobile/PWA.
- Força visibilidade normal do tile pane para neutralizar estilos legados.
- Adiciona cache stale-while-revalidate para tiles CARTO/OSM.
- Oculta os antigos polígonos decorativos de avenidas, lagos e rio sobre o mapa real.
- Reduz etiquetas permanentes de lagos no filtro “Todos”; nomes aparecem no filtro Lagos ou quando há ocorrência.
- Mantém geometria invisível de snap e seleção enquanto as vias reais são recalibradas.

# v6.3.0 — Mapa geográfico real

- Substitui o mapa estático do loteamento por OpenStreetMap real usando Leaflet.
- A visualização inicial cobre o Deltaville atual e a área do Deltaville Marine ao norte.
- Preserva ocorrências e pontos existentes através de uma transformação de compatibilidade entre as coordenadas do mapa antigo e latitude/longitude.
- Pontos novos passam a ser posicionados sobre coordenadas geográficas reais, mantendo os campos legados para compatibilidade com o banco atual.
- Ajusta cálculos de distância e snap de vias para metros.
- Mantém long press + arraste, seleção de trechos, filtros, lagos, rio e ocorrências sobre o mapa real.
- Mantém a geometria antiga praticamente invisível; o destaque aparece somente em monitoramento/seleção.
- Adiciona atribuição obrigatória do OpenStreetMap e reposiciona a atribuição no mobile.

# v6.2.2 — Circuito contínuo e seleção vetorial

- Mantém a direção real do arraste em vias fechadas, sem trocar de lado ao cruzar o ponto de fechamento.
- A Av. Deltaville passa a aceitar seleção contínua ao redor de todo o circuito oval.
- Persiste a extensão/direção do trecho selecionado para reabrir e editar corretamente.
- Ajuste das alças mantém a continuidade do circuito.
- Simplifica o destaque selecionado para uma rota azul contínua, mais próxima do comportamento do Google Maps.
- Afasta o painel “Trecho marcado” do FAB e da navegação inferior.
- Mantém as geometrias de reconhecimento praticamente invisíveis.

# v6.2.1 — Vias conectadas e seleção estilo Maps

- Corrige o painel “Trecho marcado” para ficar acima da navegação inferior.
- Remove o botão redundante “Marcar ponto” do mapa mobile; long press passa a ser o gesto principal.
- Deixa a geometria de reconhecimento das vias quase invisível para preservar o desenho original do mapa.
- Mantém azul forte somente no trecho selecionado.
- Conecta os nós das avenidas nos cruzamentos conhecidos.
- Modela a Av. Deltaville como circuito fechado/oval ao redor do canteiro central.
- Adiciona suporte a seleção que atravessa o ponto de fechamento do circuito usando o arco mais curto.
- Persiste a informação de trecho circular nas ocorrências para reabrir e editar corretamente.
- Move cartões de detalhe do mapa para uma zona segura acima da barra inferior.

# v6.2.0 — Mapa redesenhado e seleção por arraste

- Mantém a nova Home mobile no padrão Apple/iOS 27 aprovado.
- Remove o título “Mapa do Deltaville” do topo no mobile; permanecem somente Voltar e os filtros.
- Transforma Centralizar e Legenda em controles flutuantes compactos.
- Torna o mapa realmente full-screen atrás das superfícies de vidro.
- Reduz a espessura visual dos overlays das avenidas para preservar os nomes e detalhes do mapa-base.
- Refina os traçados internos das avenidas com mais pontos de snap.
- Aumenta apenas a área invisível de toque das vias, facilitando seleção sem engrossar o desenho.
- Implementa long press + arraste sobre avenida: o app identifica a via, trava a seleção nela e delimita o trecho conforme o dedo se move.
- Ao soltar, o trecho fica salvo no mapa e pode ser ajustado pelas duas alças.
- Long press fora de uma avenida continua marcando ponto exato.
- Durante o arraste, o pan/zoom é temporariamente suspenso para evitar conflito de gestos.
- Atualiza instruções do mapa para explicar o novo gesto.

# v6.1.0 — Redistribuição mobile iOS 27

- Reorganiza a Home mobile seguindo a distribuição aprovada, mantendo o visual Apple/iOS 27 já adotado.
- Remove a foto/hero do bairro: a Home passa direto do contexto local para os dados úteis.
- Cria grade 2x2 com Condições atuais, Nível do Rio Biguaçu, Relatos nas últimas 24h e Ocorrências ativas.
- Mantém o monitor completo do Rio Biguaçu recolhido por padrão e acessível ao tocar no card do rio.
- Adiciona lista compacta de ocorrências recentes e CTA comunitário “A sua voz faz a diferença”.
- Header mobile passa a ter logo/nome, sino e avatar do morador.
- Bottom navigation volta ao fluxo Painel, Mapa, Registrar, Alertas e Perfil.
- Tela de Alertas ganha abas Comunidade e Fontes de monitoramento.
- Dados compactos são alimentados pelas fontes reais já existentes de clima, rio, ocorrências e conexão.
- Mantém glassmorphism, SF Pro, dark mode, blur e feedbacks da linguagem iOS 27.
- Inclui weather.js na verificação sintática do projeto.

# v6.0.6 — Nome da marca no mobile

- Exibe “Monitora Deltaville” ao lado da logo no cabeçalho mobile.
- Mantém o header compacto de 52–54 pt.
- Usa cores adaptativas para modo claro e escuro.
- Preserva o sino de alertas à direita sem aumentar a altura da barra.

# v6.0.5 — Cabeçalho mobile compacto

- Reduz o cabeçalho mobile para aproximadamente 52–54 pt.
- Diminui logo e sino mantendo área de toque confortável.
- Remove o excesso de espaço vazio entre a barra superior e o card de clima.
- Reduz o padding superior do conteúdo no iPhone.

# v6.0.4 — Previsão do tempo mobile

- Corrige a sobreposição mostrada no iPhone entre “Próx. 6h”, chuva e resumo da previsão.
- Separa estruturalmente a linha principal e o resumo meteorológico.
- Mantém ícone, temperatura e chuva em uma única linha estável.
- Move a frase detalhada da previsão para uma segunda linha própria.
- Ajusta larguras para telas de até 390 px sem colisão de conteúdo.

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