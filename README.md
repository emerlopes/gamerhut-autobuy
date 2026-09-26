# GamerHut AutoBuy

Extensão para Chrome (e navegadores baseados em Chromium) que **monitora um produto em pré-venda na [Gamer Hut](https://www.gamerhut.com.br)**, coloca ele no carrinho assim que liberar e deixa o checkout pronto para você pagar.

> **O pagamento é sempre manual.** A extensão para na tela de "Finalizar compra" e a aba fica com você. Ela nunca digita dados de cartão, nunca confirma um pedido e nunca fecha a sua aba.

**Versão:** 1.0.0 (primeira versão)

---

## Sumário

- [O que ela faz](#o-que-ela-faz)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Primeira configuração](#primeira-configuração)
- [Monitorar outro produto (URL personalizada)](#monitorar-outro-produto-url-personalizada)
- [Como usar](#como-usar)
- [Teste antes do dia da pré-venda](#teste-antes-do-dia-da-pré-venda)
- [Entendendo o painel](#entendendo-o-painel)
- [Regras de segurança](#regras-de-segurança)
- [Atualizar e desinstalar](#atualizar-e-desinstalar)
- [Problemas comuns](#problemas-comuns)
- [Privacidade](#privacidade)
- [Aviso](#aviso)
- [Para desenvolvedores](#para-desenvolvedores)
- [Licença](#licença)

---

## O que ela faz

Você clica em **Iniciar monitoramento** e a extensão, na aba em que você já está logado:

1. Abre a página do produto configurado.
2. Recarrega a página de tempos em tempos (padrão: a cada 10 s) até o botão **Comprar** aparecer.
3. Clica em **Comprar** e confirma que o produto entrou no carrinho.
4. Preenche o seu **CEP**, escolhe a **primeira opção de frete** e clica em **Finalizar compra**.
5. **Para** e avisa você com uma notificação. A partir daí é com você: escolha o pagamento e conclua o pedido.

Se o produto já estiver no carrinho quando você iniciar, ela pula direto para o checkout sem clicar em Comprar de novo.

## Requisitos

- **Google Chrome**, **Microsoft Edge**, **Brave**, **Opera** ou outro navegador baseado em Chromium, em versão recente.
- Uma conta na Gamer Hut e **login feito** no navegador.
- O seu CEP de entrega.

> Firefox e Safari **não** são suportados nesta versão.

---

## Instalação

A extensão ainda não está na Chrome Web Store. Por isso, a instalação é feita no **modo do desenvolvedor**, carregando a pasta do projeto. Leva uns 2 minutos.

### Passo 1: baixe a extensão

Escolha uma das opções:

**Opção A: baixar o ZIP (mais fácil)**

1. Nesta página do GitHub, clique no botão verde **Code** → **Download ZIP**.
2. Descompacte o arquivo. Você vai ter uma pasta chamada `gamerhut-autobuy-main`.
3. Guarde essa pasta em um lugar fixo, por exemplo `Documentos/gamerhut-autobuy`.

> ⚠️ **Não apague nem mova a pasta depois de instalar.** O navegador lê a extensão direto dela. Se a pasta sumir, a extensão para de funcionar.

**Opção B: clonar com Git**

```bash
git clone https://github.com/emerlopes/gamerhut-autobuy.git
```

### Passo 2: carregue no navegador

1. Abra a página de extensões do seu navegador:

   | Navegador | Endereço              |
   | --------- | --------------------- |
   | Chrome    | `chrome://extensions` |
   | Edge      | `edge://extensions`   |
   | Brave     | `brave://extensions`  |
   | Opera     | `opera://extensions`  |

2. Ative o **Modo do desenvolvedor** (no Chrome, é a chave no canto superior direito; no Edge, fica na barra lateral esquerda).
3. Clique em **Carregar sem compactação** (em inglês, _Load unpacked_).
4. Selecione a pasta da extensão, **a que contém o arquivo `manifest.json`**. Se você baixou o ZIP, é a pasta `gamerhut-autobuy-main`.
5. O card **GamerHut AutoBuy 1.0.0** aparece na lista. Pronto, está instalada.

### Passo 3: fixe o ícone na barra

1. Clique no ícone de quebra-cabeça 🧩 ao lado da barra de endereço.
2. Clique no alfinete 📌 ao lado de **GamerHut AutoBuy**.

Assim o ícone fica sempre visível, e você acompanha o status pelo selo (badge) em cima dele.

> Ao iniciar o navegador, o Chrome pode mostrar um aviso sobre "extensões no modo do desenvolvedor". Isso é normal para extensões instaladas fora da loja. Basta fechar o aviso.

---

## Primeira configuração

Faça isso só uma vez:

1. Clique no ícone da extensão.
2. Clique na **engrenagem** (Configurações), no canto superior direito do painel.
3. Em **Produto**, escolha o produto que você quer monitorar:
   - **Zelda: Ocarina of Time** (Switch 2, pré-venda);
   - **Zelda: Link's Awakening** (marcado como TESTE, é um produto disponível para você testar o fluxo);
   - **Outro produto**: qualquer produto da Gamer Hut, informando a URL. Veja [Monitorar outro produto](#monitorar-outro-produto-url-personalizada).
4. Em **Entrega**, informe o seu **CEP** (8 dígitos).
5. Se quiser, ajuste o **Monitoramento**:
   - **Atualizar a cada**: intervalo entre as verificações, de 3 a 40 segundos (padrão 10).
   - **Parar após**: limite de tempo esperando o produto liberar, de 1 a 240 minutos (padrão 30).
6. Clique em **Salvar**.

A opção **Preparar o checkout automaticamente** vem ligada. Se você desligar, a extensão para logo depois de colocar o produto no carrinho, sem preencher CEP nem frete.

## Monitorar outro produto (URL personalizada)

A extensão não se limita aos dois Zeldas: ela monitora **qualquer produto da Gamer Hut**. Basta informar o link da página do produto.

### Como pegar a URL certa

1. Abra o produto no site da Gamer Hut, na **página do próprio produto** (a que tem o botão Comprar, ou o aviso de indisponível/pré-venda).
2. Copie o endereço completo da barra do navegador.

Exemplo de URL válida:

```text
https://www.gamerhut.com.br/the-legend-of-zelda-links-awakening-switch-midia-fisica
```

Não servem:

- páginas de categoria, busca ou da home (`https://www.gamerhut.com.br/nintendo-switch-2`, `.../buscar?q=zelda`);
- a página do carrinho ou do checkout;
- links de outras lojas. A extensão só tem acesso a `gamerhut.com.br`.

> **Tem link de criador de conteúdo ou de campanha?** Cole o link **exatamente como recebeu**, com os parâmetros `?utm_source=...`. A extensão abre sempre essa URL exata, então a indicação do criador é mantida.

### Configurando

1. Clique no ícone da extensão → **engrenagem**.
2. Em **Produto**, marque **Outro produto**. O campo **URL do produto** aparece.
3. Cole a URL.
4. Confira o **CEP** e clique em **Salvar**.

No topo do painel aparece o nome do produto, tirado da própria URL (por exemplo, "The legend of zelda links awakening switch midia fisica"). É assim que você confere se salvou o produto certo.

### O que acontece quando você inicia

- A extensão abre a URL e **descobre sozinha o ID do produto** lendo a página. Você não precisa informar nada além do link.
- Se a URL não for de uma página de produto, ela não inicia e mostra **"Não encontrei um produto na URL configurada. Confira a URL."**
- Daí em diante o fluxo é igual ao dos produtos prontos: monitora, compra **1 unidade**, prepara o checkout e para antes do pagamento. Se o carrinho tiver mais de uma unidade desse produto, ela reduz para 1 (nunca aumenta).

### Dicas

- **Teste antes.** Se o produto que você quer ainda não liberou, faça o [ensaio](#teste-antes-do-dia-da-pré-venda) com um produto parecido que já esteja à venda, usando **Outro produto**. Depois remova o item do carrinho e clique em **Nova monitoração**.
- **Produtos com opções** (cor, tamanho, edição escolhida em um seletor) não foram testados nesta versão. Prefira o link direto de um produto sem escolha de variação.
- **Um produto por vez.** A extensão monitora um único produto. Para trocar, pare a execução, mude a URL nas Configurações e salve.
- Se você trocar de produto, o histórico e a proteção do produto anterior não bloqueiam o novo.

## Como usar

1. Faça **login na Gamer Hut** normalmente.
2. Em qualquer aba, clique no ícone da extensão → **Iniciar monitoramento**.
   A extensão leva essa aba para a URL do produto configurado.
3. **Deixe essa aba em primeiro plano.** O navegador pode desacelerar abas em segundo plano e atrasar a detecção.
4. Quando o produto liberar, você recebe a notificação **"🔥 Produto no carrinho!"**. Logo depois, **"Checkout preparado. Assuma a aba para pagar."**
5. Vá para a aba, escolha a forma de pagamento e conclua o pedido você mesmo.

Para interromper a qualquer momento, clique em **Parar**. A aba fica exatamente como está.

### Quando a extensão para sozinha

- Quando o checkout fica pronto e é a sua vez de pagar.
- Quando o tempo limite acaba sem o produto liberar (padrão 30 min). Esse limite só vale **antes** do carrinho.
- Quando você fecha a aba monitorada ou reinicia o navegador.
- Quando algo sai do esperado e ela precisa de você. O painel mostra o motivo.

---

## Teste antes do dia da pré-venda

Vale a pena fazer um ensaio com um produto que já está à venda, **sem pagar nada**:

1. Em Configurações, escolha **Zelda: Link's Awakening (TESTE)** e salve.
2. Clique em **Iniciar monitoramento**.
3. O fluxo deve ir até a página de **Finalizar compra** e parar.
4. **Não pague.** Remova o Link's Awakening do seu carrinho na Gamer Hut.
5. No painel, clique em **Nova monitoração** e confirme.
6. Volte às Configurações, escolha o produto que você quer de verdade e salve.

---

## Entendendo o painel

O painel mostra o status atual, as etapas (produto → carrinho → CEP → frete → finalizar), o tempo restante e um registro de **Atividade** com tudo o que a extensão fez.

O selo em cima do ícone resume o status:

| Selo                  | Significado                                      |
| --------------------- | ------------------------------------------------ |
| `MON`                 | Monitorando, esperando o produto liberar         |
| `!` / `...`           | Produto disponível, adicionando ao carrinho      |
| `CART`                | Produto no carrinho                              |
| `CEP` / `FRT` / `FIN` | Preenchendo CEP, escolhendo frete, finalizando   |
| `OK`                  | Checkout pronto: é a sua vez de pagar            |
| `ERR`                 | Algo deu errado. Abra o painel para ver o motivo |
| `30m`                 | Tempo limite atingido sem o produto liberar      |

Botões que podem aparecer:

- **Iniciar monitoramento**: começa do zero.
- **Parar**: interrompe na hora, sem mexer na aba.
- **Continuar checkout**: retoma o checkout quando o produto já está no carrinho.
- **Ir para a aba…**: leva você à aba em que a automação está rodando.
- **Nova monitoração**: limpa o status e o histórico da execução anterior. Pede confirmação.

---

## Regras de segurança

A extensão foi feita para **nunca comprar duas vezes** e nunca fazer nada que você não possa desfazer:

- **Pagamento manual, sempre.** Ela para na tela de Finalizar compra.
- **Sem compra duplicada.** Antes de clicar em Comprar, ela lê o seu carrinho real. Se o produto já estiver lá, não clica.
- **Carrinho protegido.** Depois que o produto entra no carrinho, ela nunca volta a monitorar nem clica em Comprar de novo. Problemas com CEP ou frete são resolvidos recarregando o carrinho (até 5 tentativas). Se não der, ela para e pede sua ajuda.
- **Não recompra.** Se o produto esteve no carrinho e depois sumiu (você já fez o pedido? removeu o item?), ela não compra de novo. Só a **Nova monitoração**, com confirmação, libera um novo ciclo.
- **Recuperação automática.** Se a página travar ou a internet cair, a cada 30 s ela confere e recarrega no ponto seguro: a página do produto antes do carrinho, o carrinho depois.
- **Nunca fecha a sua aba.**

---

## Atualizar e desinstalar

**Atualizar para uma versão nova**

1. Baixe a versão nova (ZIP ou `git pull`) e substitua o conteúdo da **mesma pasta**.
2. Em `chrome://extensions`, clique no ícone de **recarregar** ↻ no card da GamerHut AutoBuy.

Se você baixou em outra pasta, remova a extensão antiga e carregue a pasta nova, como na instalação.

**Desinstalar**

Em `chrome://extensions`, clique em **Remover** no card da extensão. Depois pode apagar a pasta.

---

## Problemas comuns

**"Sessão não detectada: faça login na Gamer Hut…"**
Você não está logado na loja. Entre na sua conta na mesma janela do navegador e clique em Iniciar de novo.

**O botão Iniciar está desabilitado.**
Falta configurar o CEP. Abra a engrenagem, informe os 8 dígitos e salve.

**"Não encontrei um produto na URL configurada."**
A URL em **Outro produto** não é de uma página de produto da Gamer Hut. Abra o produto no site, copie o endereço da barra e cole de novo. Veja [como pegar a URL certa](#como-pegar-a-url-certa).

**"Não consegui abrir/ler a URL configurada."**
A URL não é da Gamer Hut (a extensão só funciona em `gamerhut.com.br`), está incompleta, ou a página demorou mais de 30 s para carregar. Confira o link e tente de novo.

**"Produto já esteve no carrinho e sumiu."**
É a proteção contra compra duplicada. Confira no site se o pedido já foi feito. Se tiver certeza de que quer tentar de novo, clique em **Nova monitoração**.

**A extensão demorou para perceber que o produto liberou.**
Deixe a aba monitorada em primeiro plano e o computador sem entrar em repouso. Você também pode diminuir o intervalo em **Atualizar a cada**.

**Não acho a opção "Carregar sem compactação".**
Ela só aparece com o **Modo do desenvolvedor** ativado.

**Erro "Manifest file is missing or unreadable" ao carregar.**
Você selecionou a pasta errada. Escolha a pasta que tem o `manifest.json` diretamente dentro dela. Às vezes o ZIP cria uma pasta dentro de outra.

**Algo diferente deu errado.**
Abra o painel, expanda **Atividade** e veja as últimas mensagens. Se for um bug, [abra uma issue](https://github.com/emerlopes/gamerhut-autobuy/issues) com essas mensagens e a versão do navegador.

---

## Privacidade

- A extensão só tem acesso a páginas de `gamerhut.com.br`. Ela não lê nenhum outro site.
- Configuração, status e histórico ficam **apenas no seu navegador** (`chrome.storage.local`).
- Nada é enviado para servidores de terceiros. A única comunicação é com a própria Gamer Hut, usando a sua sessão.
- Ela não lê, não guarda e não preenche dados de pagamento.

## Aviso

Projeto independente, feito pela comunidade. **Não tem nenhuma relação com a Gamer Hut nem com a Nintendo.**

A extensão depende da estrutura atual do site da Gamer Hut. Se a loja mudar o layout, ela pode parar de funcionar até ser atualizada. Use por sua conta e risco e acompanhe a aba durante a pré-venda.

---

## Para desenvolvedores

Não há build. É JavaScript puro com Manifest V3: edite os arquivos e clique em recarregar ↻ em `chrome://extensions`.

| Arquivo                                 | Papel                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `manifest.json`                         | Manifest V3, permissões só para gamerhut.com.br                                                    |
| `background.js`                         | Service worker: único dono do estado, início/parada, limite de tempo, cão de guarda e notificações |
| `content.js`                            | Age na página: detecta disponibilidade, Comprar, carrinho, CEP, frete e Finalizar                  |
| `comum.js`                              | Seletores (levantados do HTML real da loja), estados, presets e utilidades                         |
| `popup.html` / `popup.css` / `popup.js` | Painel: status, etapas, atividade e configurações                                                  |
| `icons/`                                | Ícones da extensão                                                                                 |

**Permissões usadas:** `storage` (configuração e estado), `tabs` e `scripting` (controlar a aba monitorada), `alarms` (tempo limite e cão de guarda) e `notifications` (avisos).

Para depurar: `chrome://extensions` → **service worker** no card da extensão abre o console do background. Na aba da Gamer Hut, o DevTools mostra os logs do content script (prefixo `[GH]`).

Contribuições são bem-vindas. Abra uma issue ou um pull request.

## Licença

Distribuído sob a licença [MIT](LICENSE). Você pode usar, copiar, modificar e redistribuir o código, desde que mantenha o aviso de copyright e a licença.
