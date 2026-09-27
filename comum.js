// Código compartilhado entre service worker, content script e popup.
// Seletores levantados do HTML real da Gamer Hut (Loja Integrada) em 2026-09-25.
globalThis.GH = globalThis.GH || (() => {
  const BASE = "https://www.gamerhut.com.br";

  const PRESETS = {
    ocarina: {
      nome: "Zelda: Ocarina of Time — Switch 2 (pré-venda)",
      productUrl:
        "https://www.gamerhut.com.br/the-legend-of-zelda-ocarina-of-time-switch-2-br-midia-fisica" +
        "?utm_source=nintendo_barato&utm_medium=creator" +
        "&utm_campaign=zelda_ocarina_of_time_2026_nintendo_barato&utm_content=switch_2",
      productId: "403769646",
    },
    links: {
      nome: "Zelda: Link's Awakening — Switch (TESTE)",
      productUrl: "https://www.gamerhut.com.br/the-legend-of-zelda-links-awakening-switch-midia-fisica",
      productId: "402880567",
    },
  };

  const CONFIG_PADRAO = {
    preset: "ocarina",
    productUrl: PRESETS.ocarina.productUrl,
    productId: PRESETS.ocarina.productId,
    cep: "",
    pollSeconds: 10,
    maxMinutes: 30,
    prepararCheckout: true,
    freteTimeoutSeconds: 25,
    exigirLogin: true, // só para testes: false permite rodar sem sessão
  };

  const S = {
    produtoIdInput: '.produto-detalhes input[name="produto_id"]',
    acoesProduto: (id) => `.produto-detalhes .principal .acoes-produto[data-produto-id="${id}"]`,
    botaoComprar: (id) => `a.botao-comprar[href*="/carrinho/produto/${id}/adicionar"]`,
    classeDisponivel: "disponivel",
    classeIndisponivel: "indisponivel",
    textoIndisponivel: /indispon[ií]vel/i,
    carrinhoTabela: "table.tabela-carrinho",
    carrinhoVazio: ".carrinho.vazio",
    carrinhoLinha: (id) => `table.tabela-carrinho tr[data-produto-id="${id}"]`,
    carrinhoQtdInput: 'input[name="quantidade"]',
    carrinhoQtdAtualizar: "button.atualizar-quantidade",
    cepInput: "#calcularFrete",
    cepBotao: "#btn-frete",
    freteOpcoes: 'input[type="radio"][name="formaEnvio"]',
    finalizarBotao: 'form[action*="/checkout/redirect"] button',
    finalizarTexto: /finalizar compra/i,
  };

  const URLS = {
    carrinho: `${BASE}/carrinho/index`,
    conta: `${BASE}/conta/index`,
  };

  const STATUS = {
    IDLE: "IDLE",
    MONITORANDO: "MONITORANDO",
    DISPONIVEL: "DISPONIVEL",
    ADICIONANDO_AO_CARRINHO: "ADICIONANDO_AO_CARRINHO",
    PRODUTO_NO_CARRINHO: "PRODUTO_NO_CARRINHO",
    PREENCHENDO_CEP: "PREENCHENDO_CEP",
    AGUARDANDO_FRETE: "AGUARDANDO_FRETE",
    FRETE_SELECIONADO: "FRETE_SELECIONADO",
    FINALIZANDO_CHECKOUT: "FINALIZANDO_CHECKOUT",
    AGUARDANDO_USUARIO: "AGUARDANDO_USUARIO",
    ERRO_RECUPERAVEL: "ERRO_RECUPERAVEL",
    ERRO_MANUAL: "ERRO_MANUAL",
    PARADO: "PARADO",
    TEMPO_ESGOTADO: "TEMPO_ESGOTADO",
  };

  // Estados em que a automação está rodando e deve agir na aba.
  const ATIVOS = new Set([
    STATUS.MONITORANDO, STATUS.DISPONIVEL, STATUS.ADICIONANDO_AO_CARRINHO,
    STATUS.PRODUTO_NO_CARRINHO, STATUS.PREENCHENDO_CEP, STATUS.AGUARDANDO_FRETE,
    STATUS.FRETE_SELECIONADO, STATUS.FINALIZANDO_CHECKOUT, STATUS.ERRO_RECUPERAVEL,
  ]);

  // Estados que só existem com o produto confirmado no carrinho.
  const PROTEGIDOS = new Set([
    STATUS.PRODUTO_NO_CARRINHO, STATUS.PREENCHENDO_CEP, STATUS.AGUARDANDO_FRETE,
    STATUS.FRETE_SELECIONADO, STATUS.FINALIZANDO_CHECKOUT, STATUS.AGUARDANDO_USUARIO,
  ]);

  const semWww = (h) => h.replace(/^www\./, "");

  function ehGamerHut(url) {
    try { return semWww(new URL(url).hostname) === "gamerhut.com.br"; } catch { return false; }
  }

  // Mesmo produto: mesmo host e caminho (ignora a query).
  function mesmoProduto(a, b) {
    try {
      const ua = new URL(a), ub = new URL(b);
      return semWww(ua.hostname) === semWww(ub.hostname) &&
        ua.pathname.replace(/\/$/, "") === ub.pathname.replace(/\/$/, "");
    } catch { return false; }
  }

  // Mesma URL exata: mesmo produto e TODOS os parâmetros iguais (inclusive UTM).
  function mesmaUrl(a, b) {
    if (!mesmoProduto(a, b)) return false;
    const q = (u) => [...new URL(u).searchParams.entries()].map((p) => p.join("=")).sort().join("&");
    return q(a) === q(b);
  }

  function tipoPagina(url, productUrl) {
    if (!ehGamerHut(url)) return "outra";
    const p = new URL(url).pathname;
    if (mesmoProduto(url, productUrl)) return "produto";
    if (/^\/carrinho\/index/.test(p)) return "carrinho";
    if (/^\/checkout(?!\/redirect)/.test(p)) return "checkout";
    if (/^\/conta\/login/.test(p)) return "login";
    return "outra";
  }

  // Quantidade do produto no carrinho a partir de um Document.
  // null = indeterminado (página não é claramente o carrinho). Nunca chuta 0.
  function qtdNoCarrinho(doc, productId) {
    const linha = doc.querySelector(S.carrinhoLinha(productId));
    if (linha) return parseInt(linha.getAttribute("data-produto-quantidade") || "1", 10);
    if (doc.querySelector(S.carrinhoTabela) || doc.querySelector(S.carrinhoVazio)) return 0;
    return null;
  }

  // Lê o carrinho real via fetch (mesma sessão/cookies), sem sair da página.
  async function qtdCarrinhoFetch(productId) {
    const r = await fetch(URLS.carrinho, { credentials: "include", cache: "no-store" });
    if (!r.ok || !/\/carrinho\/index/.test(r.url)) return null;
    const doc = new DOMParser().parseFromString(await r.text(), "text/html");
    return qtdNoCarrinho(doc, productId);
  }

  async function sessaoAutenticada() {
    const r = await fetch(URLS.conta, { credentials: "include", cache: "no-store" });
    return !/\/conta\/login/.test(r.url);
  }

  const hora = (t = Date.now()) => new Date(t).toLocaleTimeString("pt-BR", { hour12: false });

  return {
    BASE, PRESETS, CONFIG_PADRAO, S, URLS, STATUS, ATIVOS, PROTEGIDOS,
    ehGamerHut, mesmoProduto, mesmaUrl, tipoPagina, qtdNoCarrinho, qtdCarrinhoFetch,
    sessaoAutenticada, hora,
  };
})();
