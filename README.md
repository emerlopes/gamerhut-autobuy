# GamerHut AutoBuy — extensão do Chrome

Trabalha na aba da Gamer Hut que você já tem aberta e logada, no seu Chrome de sempre.
Você clica em **Iniciar**, ela monitora o produto, clica em **Comprar**, confirma o carrinho, preenche o CEP,
seleciona o **primeiro** frete e clica em **Finalizar compra**. Aí para e a aba fica com você para pagar.
O pagamento nunca é automatizado.

## Instalar

1. Chrome → `chrome://extensions`
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. **Carregar sem compactação** → selecione a pasta `extensao/`
4. Fixe o ícone (Triforce) na barra.

## Usar

1. Faça login na Gamer Hut normalmente.
2. Clique no ícone → **Configuração** → informe o **CEP** → **Salvar** (só na primeira vez).
3. Em qualquer aba, clique em **Iniciar**. A extensão leva essa aba **sempre à URL da configuração** (com UTM),
   não importa a página em que ela estava.

Ao iniciar, a extensão:
- abre a URL configurada na aba atual (não valida a aba anterior);
- lê o ID do produto dessa página e o usa (a URL é a fonte da verdade);
- confere se a sessão está logada;
- lê o carrinho real. Se o produto já estiver lá, pula direto para o checkout sem clicar em Comprar.

**Quando para:**
- quando o produto entra no carrinho: o monitoramento acaba e o checkout é preparado. Isso pode ser desligado em
  "Após o carrinho…", e aí ela para logo após confirmar o carrinho;
- quando você clica em **Parar**;
- depois de **30 min** sem o produto liberar (configurável). Esse limite vale só antes do carrinho.

Mantenha a aba em primeiro plano durante o monitoramento. Abas em segundo plano podem ser desaceleradas pelo Chrome.

## Regras de segurança

- **Carrinho protegido:** confirmado o produto no carrinho, a extensão nunca volta a monitorar nem clica em Comprar de
  novo. Erros de CEP ou frete são recuperados recarregando o **carrinho** (até 5 tentativas). Depois disso, `ERRO_MANUAL`.
- **Não duplicação:** antes de qualquer nova tentativa de Comprar, o carrinho real é lido (via `fetch` na mesma sessão).
- **Reativação:** o carrinho real vale mais que o estado salvo. Se o estado diz que o produto esteve no carrinho, mas o
  carrinho está vazio (pedido feito? item removido?), ela **não recompra**. Só o botão **Nova monitoração** (com confirmação) limpa esse estado.
- **Parar** é imediato e não mexe na aba. A extensão nunca fecha a aba.
- **Cão de guarda:** se a aba travar ou der erro de rede, a cada 30s o service worker recarrega no ponto seguro:
  o produto antes do carrinho, o carrinho depois.

## Testar antes (sem pagar nada)

Na Configuração, escolha **Link's Awakening (TESTE)**, salve, abra a página dele e clique em **Iniciar**. O fluxo deve
chegar à página de Finalizar compra.
Depois **remova o Link's Awakening do carrinho** e clique em **Nova monitoração**.
Volte o produto para **Ocarina of Time** e salve.

## Arquivos

| Arquivo | Papel |
|---|---|
| `manifest.json` | Manifest V3, permissões só para gamerhut.com.br |
| `background.js` | service worker: único dono do estado, início/parada, limite de tempo, cão de guarda, notificações |
| `content.js` | age na página: detecta disponibilidade, Comprar, carrinho, CEP, frete, Finalizar |
| `comum.js` | seletores (levantados do HTML real), estados, presets e utilidades |
| `popup.*` | painel: status, etapas, log, configuração |
