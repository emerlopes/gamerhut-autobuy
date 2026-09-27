// Content script: roda a cada carregamento de página da Gamer Hut.
// Só age na aba em execução, e decide o passo pelo estado + tipo da página:
//   produto  -> monitora / clica Comprar (NUNCA com carrinho protegido)
//   carrinho -> confirma produto; CEP -> primeiro frete -> Finalizar compra
//   checkout -> PARA (AGUARDANDO_USUARIO). Pagamento nunca é tocado.
(() => {
  if (globalThis.__ghContentCarregado) return;
  globalThis.__ghContentCarregado = true;

  const { S, STATUS, ATIVOS, URLS } = GH;
  let meuTabId = null;
  let abortado = false;
  let timer = null;

  // ------------------------------------------------------------ utilidades --
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const enviar = (msg) => chrome.runtime.sendMessage(msg);

  async function lerTudo() {
    const { config, run } = await chrome.storage.local.get(["config", "run"]);
    return { cfg: { ...GH.CONFIG_PADRAO, ...(config || {}) }, run: run || null };
  }

  async function patch(p, log, nivel = "info") {
    if (abortado) throw new Abortado();
    const r = await enviar({ type: "patch", patch: p, log, nivel });
    if (!r?.run || r.run.tabId !== meuTabId || !ATIVOS.has(r.run.status)) {
      // Estado final (ok) ou execução parada: nada mais a fazer nesta página.
      if (r?.run && !ATIVOS.has(r.run.status)) abortado = true;
    }
    return r?.run;
  }

  class Abortado extends Error {}

  function checarAbortado() {
    if (abortado) throw new Abortado();
  }

  function ir(url) {
    checarAbortado();
    location.assign(url);
  }

  function agendarRecarga(segundos, url) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!abortado) url ? location.assign(url) : location.reload();
    }, segundos * 1000);
  }

  function visivel(el) {
    if (!el || !el.isConnected) return false;
    const st = getComputedStyle(el);
    return el.getClientRects().length > 0 && st.visibility !== "hidden" && st.display !== "none";
  }

  // Pare imediatamente quando o usuário clicar em Parar (ou o estado mudar).
  chrome.storage.onChanged.addListener((mud, area) => {
    if (area !== "local" || !mud.run) return;
    const run = mud.run.newValue;
    if (!run || run.tabId !== meuTabId || !ATIVOS.has(run.status)) {
      abortado = true;
      clearTimeout(timer);
    }
  });

  // --------------------------------------------------------- disponibilidade -
  function verificarDisponibilidade(productId) {
    const idPagina = document.querySelector(S.produtoIdInput)?.value;
    if (idPagina && idPagina !== productId) return { disponivel: false, motivo: `página é de outro produto (${idPagina})` };

    const acoes = document.querySelector(S.acoesProduto(productId));
    if (!acoes) return { disponivel: false, motivo: "bloco de compra do produto não encontrado" };
    if (acoes.classList.contains(S.classeIndisponivel)) return { disponivel: false, motivo: "marcado como indisponível" };

    const botao = acoes.querySelector(S.botaoComprar(productId));
    if (!botao) return { disponivel: false, motivo: "botão Comprar ausente" };
    if (!visivel(botao)) return { disponivel: false, motivo: "botão Comprar invisível" };
    if (botao.getAttribute("aria-disabled") === "true" || botao.classList.contains("disabled") || botao.hasAttribute("disabled")) {
      return { disponivel: false, motivo: "botão Comprar desabilitado" };
    }
    const msgIndisp = [...acoes.querySelectorAll("*")].some(
      (el) => el.children.length === 0 && S.textoIndisponivel.test(el.textContent) && visivel(el),
    );
    if (msgIndisp) return { disponivel: false, motivo: "mensagem de indisponibilidade visível" };

    const motivo = acoes.classList.contains(S.classeDisponivel)
      ? "botão Comprar ok + estoque disponível"
      : "botão Comprar ok (sem classe 'disponivel')";
    return { disponivel: true, motivo, botao };
  }

  // ---------------------------------------------------------- página produto -
  async function paginaProduto(run, cfg) {
    if (run.carrinhoProtegido) {
      await patch({}, "Carrinho protegido: indo ao carrinho (Comprar NÃO será clicado)");
      return ir(URLS.carrinho);
    }

    if (run.status === STATUS.ADICIONANDO_AO_CARRINHO) {
      // Houve um clique sem confirmação. Confere o carrinho antes de qualquer coisa.
      const qtd = await GH.qtdCarrinhoFetch(cfg.productId).catch(() => null);
      if (qtd === null) {
        await patch({}, "Não consegui ler o carrinho; tentando de novo (sem clicar)", "aviso");
        return agendarRecarga(3);
      }
      if (qtd >= 1) {
        await patch({ status: STATUS.PRODUTO_NO_CARRINHO, etapas: { produto: true } },
          `Carrinho detectado: produto presente (qtd ${qtd})`);
        return ir(URLS.carrinho);
      }
      run = await patch({ status: STATUS.MONITORANDO }, "Produto não está no carrinho; retomando o monitoramento", "aviso");
    } else if (run.status === STATUS.ERRO_RECUPERAVEL) {
      run = await patch({ status: STATUS.MONITORANDO, ultimoErro: null }, "Retomando o monitoramento");
    }

    if (Date.now() > run.prazo) {
      await patch({ status: STATUS.TEMPO_ESGOTADO },
        `Tempo limite de ${cfg.maxMinutes} min atingido sem liberar o produto. Monitoramento encerrado.`);
      return;
    }

    if (!GH.mesmaUrl(location.href, cfg.productUrl)) {
      await patch({}, "URL diferente da configurada (UTM); abrindo a URL exata", "aviso");
      return ir(cfg.productUrl);
    }

    const d = verificarDisponibilidade(cfg.productId);
    if (!d.disponivel) {
      await patch({ verificacoes: (run.verificacoes || 0) + 1, ultimaVerificacao: Date.now() },
        `Produto indisponível (${d.motivo})`);
      return agendarRecarga(cfg.pollSeconds);
    }

    run = await patch({ status: STATUS.DISPONIVEL }, `Produto disponível (${d.motivo})`);

    // Não duplicação: se já houve tentativa, confere o carrinho real antes de clicar.
    if ((run.tentativasCompra || 0) > 0) {
      const qtd = await GH.qtdCarrinhoFetch(cfg.productId).catch(() => null);
      if (qtd === null) {
        await patch({}, "Carrinho ilegível antes de nova tentativa; não vou clicar agora", "aviso");
        return agendarRecarga(2);
      }
      if (qtd >= 1) {
        await patch({ status: STATUS.PRODUTO_NO_CARRINHO, etapas: { produto: true } },
          `Produto JÁ está no carrinho (qtd ${qtd}); Comprar não será clicado`);
        return ir(URLS.carrinho);
      }
    }
    // Sem limite de tentativas: segue até o usuário parar. O carrinho real é conferido antes de cada clique.
    const tentativa = (run.tentativasCompra || 0) + 1;
    await patch({ status: STATUS.ADICIONANDO_AO_CARRINHO, tentativasCompra: tentativa },
      tentativa > 1 ? `Botão Comprar encontrado; clicando (tentativa ${tentativa})` : "Botão Comprar encontrado; clicando");
    checarAbortado();
    d.botao.click();
    // Se não navegar ao carrinho em 15s, recarrega: o estado ADICIONANDO força conferir o carrinho.
    agendarRecarga(15);
  }

  // --------------------------------------------------------- página carrinho -
  async function paginaCarrinho(run, cfg) {
    const qtd = GH.qtdNoCarrinho(document, cfg.productId);

    if (!run.carrinhoProtegido) {
      if (qtd === null) {
        await patch({}, "Página do carrinho ilegível; recarregando", "aviso");
        return agendarRecarga(3);
      }
      if (qtd >= 1) {
        run = await patch({ status: STATUS.PRODUTO_NO_CARRINHO, etapas: { produto: true } },
          `Carrinho detectado: produto presente (qtd ${qtd}). Estado protegido.`);
      } else {
        await patch({ status: STATUS.MONITORANDO },
          run.status === STATUS.ADICIONANDO_AO_CARRINHO
            ? "Clique feito, mas o produto não apareceu no carrinho; voltando ao produto"
            : "Produto não está no carrinho; voltando ao produto", "aviso");
        return ir(cfg.productUrl);
      }
    }
    if (!run) return;

    if (!cfg.prepararCheckout) {
      await patch({ status: STATUS.AGUARDANDO_USUARIO }, "Produto no carrinho. Preparação do checkout desativada: assuma a aba.");
      return;
    }
    return prepararCheckout(run, cfg, qtd);
  }

  async function prepararCheckout(run, cfg, qtd) {
    try {
      if (run.status === STATUS.FINALIZANDO_CHECKOUT) {
        throw new Error("Finalizar compra voltou para o carrinho");
      }
      if (qtd === null) throw new Error("carrinho ilegível");
      if (qtd === 0) {
        await patch({ status: STATUS.ERRO_MANUAL },
          "Produto NÃO está mais no carrinho. Não vou clicar em Comprar de novo; verifique manualmente.", "erro");
        return;
      }
      if (qtd > 1) return await reduzirParaUm(cfg);
      await patch({}, "Produto continua no carrinho (qtd 1)");

      // CEP
      await patch({ status: STATUS.PREENCHENDO_CEP });
      const campo = document.querySelector(S.cepInput);
      if (!campo) throw new Error("campo de CEP não encontrado");
      const anteriores = new Set(document.querySelectorAll(S.freteOpcoes));
      preencher(campo, cfg.cep);
      checarAbortado();
      document.querySelector(S.cepBotao)?.click();
      await patch({ status: STATUS.AGUARDANDO_FRETE, etapas: { cep: true } }, `CEP preenchido (***${cfg.cep.slice(-3)})`);

      // Frete
      const opcao = await esperarFrete(anteriores, cfg);
      checarAbortado();
      opcao.click();
      await esperar(300);
      if (!opcao.checked) throw new Error("opção de frete não ficou selecionada");
      const descricao = (opcao.closest("label")?.innerText || "").replace(/\s+/g, " ").trim();
      await patch({ status: STATUS.FRETE_SELECIONADO, frete: descricao, etapas: { frete: true } },
        `Primeira opção de frete selecionada: ${descricao}`);
      await esperar(1500); // deixa a loja registrar o frete e recalcular o total

      // Finalizar compra
      const botao = [...document.querySelectorAll(S.finalizarBotao)].find((b) => S.finalizarTexto.test(b.innerText));
      if (!botao) throw new Error("botão Finalizar compra não encontrado");
      await patch({ status: STATUS.FINALIZANDO_CHECKOUT }, "Clicando em Finalizar compra");
      checarAbortado();
      botao.click();
      // Se o checkout não abrir, recarrega o carrinho e a lógica acima conta como erro.
      agendarRecarga(25, URLS.carrinho);
    } catch (e) {
      if (e instanceof Abortado) return;
      // Sem limite de tentativas: segue até o usuário parar, com espera crescente (máx. 10s).
      const t = (run.tentativasCheckout || 0) + 1;
      await patch({ status: STATUS.ERRO_RECUPERAVEL, tentativasCheckout: t, ultimoErro: e.message },
        `Erro no checkout (tentativa ${t}): ${e.message}. Produto continua protegido; recarregando o carrinho.`,
        "erro").catch(() => {});
      agendarRecarga(Math.min(2 * t, 10), URLS.carrinho);
    }
  }

  function preencher(campo, valor) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    campo.focus();
    setter.call(campo, valor);
    for (const tipo of ["input", "keyup", "change"]) campo.dispatchEvent(new Event(tipo, { bubbles: true }));
  }

  async function esperarFrete(anteriores, cfg) {
    const limite = Date.now() + cfg.freteTimeoutSeconds * 1000;
    const inicio = Date.now();
    let ultimoHeartbeat = Date.now();
    while (Date.now() < limite) {
      checarAbortado();
      const opcoes = [...document.querySelectorAll(S.freteOpcoes)].filter((o) => visivel(o) && !o.disabled);
      const novas = opcoes.filter((o) => !anteriores.has(o));
      // Preferimos opções recém-renderizadas; após 8s aceitamos as já existentes.
      const candidatas = novas.length ? opcoes : (Date.now() - inicio > 8000 ? opcoes : []);
      if (candidatas.length) {
        await patch({}, `Opções de frete encontradas: ${opcoes.length}`);
        return candidatas[0];
      }
      if (Date.now() - ultimoHeartbeat > 5000) {
        await patch({});
        ultimoHeartbeat = Date.now();
      }
      await esperar(200);
    }
    throw new Error("timeout ao calcular frete");
  }

  async function reduzirParaUm(cfg) {
    const linha = document.querySelector(S.carrinhoLinha(cfg.productId));
    const input = linha?.querySelector(S.carrinhoQtdInput);
    const botao = linha?.querySelector(S.carrinhoQtdAtualizar);
    if (!input || !botao) throw new Error("não consegui ajustar a quantidade");
    await patch({}, "Carrinho com mais de 1 unidade; reduzindo para 1 (nunca aumenta)", "aviso");
    preencher(input, "1");
    checarAbortado();
    botao.click(); // envia o formulário; a página recarrega e o fluxo recomeça no carrinho
  }

  // --------------------------------------------------------- outras páginas --
  async function paginaCheckout(run) {
    if (!run.carrinhoProtegido) return;
    await patch({ status: STATUS.AGUARDANDO_USUARIO, etapas: { checkout: true } },
      "Checkout aberto. Produto no carrinho e checkout preparado. Assuma a aba para concluir o pagamento.");
  }

  // Sessão caiu: espera o login em vez de parar. Não recarrega a página (o usuário pode estar digitando);
  // confere a sessão a cada 5s e o patch mantém o cão de guarda quieto.
  async function paginaLogin(run, cfg) {
    await patch({ status: STATUS.ERRO_RECUPERAVEL, ultimoErro: "A loja pediu login. Faça login nesta aba" },
      run.carrinhoProtegido
        ? "A loja pediu login. O carrinho está preservado: faça login nesta aba e a automação continua sozinha."
        : "Sessão expirada. Faça login nesta aba e a automação continua sozinha.", "aviso");
    for (;;) {
      await esperar(5000);
      checarAbortado();
      if (await GH.sessaoAutenticada().catch(() => false)) {
        const destino = run.carrinhoProtegido ? URLS.carrinho : cfg.productUrl;
        await patch({ status: run.carrinhoProtegido ? STATUS.PRODUTO_NO_CARRINHO : STATUS.MONITORANDO, ultimoErro: null },
          `Login detectado; voltando ${run.carrinhoProtegido ? "ao carrinho" : "ao produto"}`);
        return ir(destino);
      }
      await patch({});
    }
  }

  async function outraPagina(run, cfg) {
    const destino = run.carrinhoProtegido || run.status === STATUS.ADICIONANDO_AO_CARRINHO ? URLS.carrinho : cfg.productUrl;
    await patch({}, `Página inesperada (${location.pathname}); voltando ${destino === URLS.carrinho ? "ao carrinho" : "ao produto"}`, "aviso");
    ir(destino);
  }

  // ----------------------------------------------------------------- início --
  chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
    if (msg.type !== "preflight") return;
    (async () => {
      const [logado, qtdCarrinho] = await Promise.all([
        GH.sessaoAutenticada().catch(() => false),
        GH.qtdCarrinhoFetch(msg.productId).catch(() => null),
      ]);
      const productIdPagina = document.querySelector(S.produtoIdInput)?.value
        || document.querySelector(".produto-detalhes .acoes-produto[data-produto-id]")?.dataset.produtoId
        || null;
      return { logado, qtdCarrinho, productIdPagina };
    })().then(responder);
    return true;
  });

  (async () => {
    try {
      meuTabId = (await enviar({ type: "whoami" }))?.tabId;
      const { cfg, run } = await lerTudo();
      if (!run || run.tabId !== meuTabId || !ATIVOS.has(run.status)) return;

      switch (GH.tipoPagina(location.href, cfg.productUrl)) {
        case "produto": return await paginaProduto(run, cfg);
        case "carrinho": return await paginaCarrinho(run, cfg);
        case "checkout": return await paginaCheckout(run, cfg);
        case "login": return await paginaLogin(run, cfg);
        default: return await outraPagina(run, cfg);
      }
    } catch (e) {
      if (e instanceof Abortado) return;
      console.error("[GH]", e);
      // Erro inesperado: não clica em nada; o cão de guarda recarrega a aba no ponto seguro.
      enviar({ type: "patch", patch: {}, log: `Erro inesperado na página: ${e.message}`, nivel: "erro" }).catch(() => {});
    }
  })();
})();
