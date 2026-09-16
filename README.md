# Monitora Deltaville v4.0 — mapa ilustrado expandido + registro inteligente

## Mudanças principais

- Retorno ao mapa ilustrativo próprio como fonte de verdade visual.
- Entorno ampliado e esmaecido para eliminar o corte seco nas bordas.
- Long press continua disponível no mapa.
- Marcação de vários pontos em uma única ocorrência.
- Uma ocorrência pode envolver vários locais monitorados, por exemplo Av. Wilson Castelo Branco + Av. Beira Rio.
- Registros com vários locais aparecem agrupados como uma única ocorrência na lista, mas todos os locais são sinalizados no mapa.
- Novo fluxo de registro: descrição em linguagem natural + confirmação rápida, com ajuste manual compacto.
- Interpretação local de frases comuns sobre alagamento, rio, lagos, granizo, vendaval e chuva forte.
- Quando a descrição diferencia os locais, o app tenta atribuir gravidade/condição por local.
- Ditado por voz quando o navegador suporta reconhecimento; no iPhone, o microfone do teclado continua sendo alternativa.
- Casa/lote usa seletor próprio em estilo iOS: roleta de 1 a 500 + campo para digitar e saltar diretamente ao número.
- Edição e exclusão continuam disponíveis para ocorrências próprias.
- Cache do PWA atualizado.

## Observação sobre IA

Nesta versão, a interpretação é feita localmente no aplicativo para ser imediata e não depender de chave externa. A interface foi preparada para receber um modelo generativo no backend no futuro sem mudar o fluxo para o morador.


## v4.1 — fotos nas ocorrências

- Até 3 fotos por ocorrência.
- Botões separados para tirar foto e escolher da biblioteca no iPhone.
- As imagens são redimensionadas para até 1600 px antes do envio.
- O app converte a imagem para JPEG no navegador, removendo metadados EXIF/GPS do arquivo enviado.
- As fotos ficam em bucket privado do Supabase Storage.
- Moradores autenticados recebem URLs temporárias para visualizar as fotos.
- Fotos aparecem nos cards e no detalhe da ocorrência no mapa.
- Toque na miniatura para ampliar.
- Edição permite manter, remover ou acrescentar fotos.
- Ao apagar uma ocorrência, o app também tenta remover os arquivos associados do Storage.


## v4.1.1 — correção Casa/Lote no iPhone

- Corrigido o seletor que ficava atrás da tela de acesso por conflito de z-index.
- Removido botão interativo de dentro de `<label>`, evitando comportamento inconsistente no Safari/iOS.
- Campo de busca numérica agora recebe toque e teclado normalmente.
- É possível digitar qualquer número de 1 a 500 e tocar em Concluir.
- A roleta continua disponível para deslizar ou tocar no número.
- Pressionar Enter/OK no teclado também confirma o número.


## v4.1.2 — cadastro simplificado

- Removida a roleta de 1 a 500 para casa/lote.
- Casa/lote agora é digitado diretamente em campo de uma linha.
- No celular, `inputmode="numeric"` solicita o teclado numérico.
- Validação aceita somente números entre 1 e 500.
- PIN de 6 dígitos fica oculto por padrão.
- Botão com ícone de olho permite mostrar ou ocultar o PIN quando o usuário quiser.
- Os campos de PIN também solicitam teclado numérico e aceitam somente 6 dígitos.


## v4.1.3 — UX do mapa simplificada

- O mapa agora mostra somente uma ação inferior por vez.
- Antes de marcar: aparece apenas o botão compacto “Marcar ponto”.
- Depois de marcar: esse botão some e é substituído por uma barra compacta com “Cancelar” e “Registrar”.
- O mesmo padrão vale para trecho delimitado.
- Ao abrir detalhes de uma ocorrência/local, o botão de marcação também some para não sobrepor o painel.
- O texto foi reduzido e as ações seguem divulgação progressiva, evitando redundância e sobreposição.


## v4.2 — notificações push por grau

- Web Push real para ocorrências novas, inclusive com o PWA fechado.
- Usuário ativa/desativa as notificações no Perfil.
- Preferência por grau mínimo:
  - Atenção: recebe Atenção, Alerta e Crítico.
  - Alerta: recebe Alerta e Crítico.
  - Crítico: recebe somente Crítico.
- O autor da ocorrência não recebe notificação da própria publicação.
- Crítico é enviado com prioridade alta; Alerta com prioridade normal; Atenção com prioridade baixa.
- No iPhone, Web Push requer o Monitora instalado/adicionado à Tela de Início.
- Tocar na notificação abre a ocorrência correspondente no mapa.
- Assinaturas push são armazenadas no Supabase e vinculadas ao usuário/aparelho.


## v4.3 — auditoria e otimização de produção

- Mapa principal convertido de PNG para WebP de alta qualidade: ~1,84 MB para ~217 KB.
- Removidos arquivos `.bak`, mapas antigos e recursos não utilizados.
- Código morto do antigo seletor em roleta removido.
- Supabase JS fixado em versão exata para evitar quebra por atualização automática de CDN.
- URLs assinadas das fotos agora são geradas em lote, reduzindo chamadas de rede.
- Eventos Realtime são agrupados por debounce para evitar várias recargas quando uma ocorrência tem múltiplos locais.
- Clima usa cache local e atualização periódica, evitando tela vazia em falhas temporárias.
- Service Worker revisto: navegação network-first, recursos locais stale-while-revalidate e cache de dependências estáticas externas após o primeiro uso.
- Manifest atualizado com `id`, `scope`, `lang` e metadados de PWA.
- Melhorias de acessibilidade: foco visível, `aria-current`, live region de status e suporte a redução de movimento.
- Rótulo “Cadastro de teste” removido para produção.
- Banco Supabase otimizado com índices de FKs e políticas RLS com `auth.uid()` avaliado uma vez por consulta.


## v4.3.1 — zoom controlado + rodapé permanente

- O zoom da página/interface foi bloqueado para evitar ampliação acidental do app.
- Pinch, duplo toque e os botões +/- continuam funcionando dentro do mapa Leaflet.
- No Safari/iOS, gestos de zoom da página são bloqueados apenas fora do mapa.
- O rodapé de navegação permanece visível em todas as telas, inclusive no mapa em tela cheia.
- O mapa passa a ocupar somente a área acima do rodapé.
- Controles inferiores e barras de ação ficam dentro da área útil do mapa.
- O mapa recalcula seu tamanho ao abrir para evitar cortes após a mudança de layout.


## v4.4 — localização inteligente por ocorrência

- Chuva forte, Granizo, Vendaval e Vendaval com danos não mostram mais lagos, rios ou avenidas como locais possíveis.
- Para esses fenômenos o usuário escolhe: Blue, Acqua, Garden, Brisas, Costa do Sol ou Bairro inteiro.
- É possível selecionar vários condomínios; Bairro inteiro é uma opção exclusiva.
- A IA entende frases como “granizo no Blue e no Acqua” e seleciona os dois condomínios.
- A IA entende “em todo Deltaville / bairro inteiro / todos os condomínios”.
- Vendaval com danos abre uma segunda pergunta curta: tipo de dano (árvore/galhos, telhado/estrutura, energia/postes, veículos ou outros).
- A IA também tenta identificar automaticamente os tipos de dano mencionados no texto.
- Ocorrências meteorológicas são posicionadas no mapa pelo condomínio correspondente usando âncoras do mapa ilustrado.
- O bloco de marcação de ponto exato é ocultado para fenômenos de área, simplificando o fluxo.


## v4.4.1 — até 2 moradores por casa/lote

- Cada casa/lote pode ter até 2 pessoas cadastradas.
- Os dois moradores usam o mesmo condomínio e número de lote, mas cada um possui conta e PIN próprios.
- No login, o sistema identifica automaticamente qual dos dois moradores corresponde ao PIN informado.
- O segundo morador não precisa informar nome no login; condomínio + lote + PIN continuam sendo suficientes.
- O segundo morador deve escolher um PIN diferente do primeiro.
- Ao atingir 2 moradores, novos cadastros para aquele lote são bloqueados.
- A limitação de 2 moradores também é protegida no banco de dados.


## v4.7 — dashboard desktop fiel ao conceito aprovado

A versão web passa a ter uma estrutura própria, sem reutilizar visualmente o menu mobile:
- sidebar fixa branca com logo, Início, Mapa, Registrar, Alertas e Perfil;
- cabeçalho horizontal com saudação, clima, alertas e identificação do morador;
- bloco de situação geral + indicadores;
- botão de registrar ocorrência destacado à direita;
- mapa principal amplo;
- coluna de ocorrências ativas;
- cards inferiores com previsão local e status de monitoramento;
- dados exibidos são derivados dos dados reais já existentes no app;
- layout mobile permanece independente e preservado.


## v4.8 — dashboard fiel + problemas urbanos

- Dashboard desktop reorganizado para respeitar limites de cards, botões e textos.
- Home web: KPIs + CTA, mapa principal, ocorrências ativas e três painéis inferiores.
- Painéis inferiores: alertas por grau, ocorrências resolvidas recentes e status por área.
- Nova página desktop de Relatórios.
- Novos tipos de problema:
  - iluminação pública;
  - bueiro/drenagem;
  - árvore/galhos;
  - buraco/pavimento;
  - energia/poste;
  - esgoto/vazamento;
  - lixo/entulho;
  - sinalização;
  - calçada/obstrução;
  - abastecimento de água;
  - estrutura danificada;
  - outro problema.
- Assistente local reconhece frases comuns para os novos tipos.
- Problemas urbanos podem ser marcados em condomínio, local monitorado, bairro inteiro, outro local ou ponto exato do mapa.


## v4.8.1 — correção de encaixe desktop

- evita sobreposição visual entre clima do topo e CTA de registrar ocorrência;
- reorganiza a home desktop para caber na viewport sem rolagem vertical da página;
- reduz alturas de header, KPI, CTA e cards inferiores;
- passa scroll apenas para listas internas quando necessário.


## v4.8.3 — mapa desktop estável

- página do mapa reestruturada em workspace real de desktop;
- mapa principal à esquerda e painel de informações/ações à direita;
- título, filtros, marcar ponto, detalhe e locais monitorados permanecem visíveis;
- mapa recebe reflow robusto do Leaflet após mudança de página, resize e orientação;
- listas laterais rolam internamente sem deslocar a tela inteira;
- mobile preservado.


## v4.8.4 — refinamento UX

- zoom com roda do mouse/trackpad habilitado no mapa completo do desktop;
- cabeçalho e previsão do tempo ganharam área própria, sem sobrepor o CTA de registro;
- maior respiro entre conteúdo inferior e limite da viewport;
- home continua em tela única quando houver altura suficiente;
- notebooks/telas baixas passam a rolar a página em vez de comprimir excessivamente os cards;
- melhorias de foco, hover, cursores e feedback visual.


## v4.8.5 — UX mobile refinada

- pinch zoom, arrastar e duplo toque explícitos no mapa mobile;
- cabeçalho sticky com blur e melhor leitura;
- melhor respiro entre cards e rodapé;
- áreas de toque maiores;
- formulários/sheets com rolagem própria;
- chips e seleção de tipos reorganizados para telas pequenas;
- mantém o rodapé móvel fixo e o mapa com gestos independentes do zoom da página.


## v4.8.6 — categorias completas no mobile

- categorias de clima/água e infraestrutura/manutenção ficam visíveis diretamente no formulário mobile;
- iluminação, árvores, buracos, sinalização, calçada, energia, água, esgoto, lixo, estrutura e outros problemas aparecem sem precisar abrir "manual";
- grid responsivo em 2 colunas e 1 coluna em telas muito estreitas;
- fotos foram deslocadas abaixo das categorias para priorizar o tipo de ocorrência.
