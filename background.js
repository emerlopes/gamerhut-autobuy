// Service worker: ÚNICO gravador do estado em chrome.storage.local.
// - valida e inicia a execução (Iniciar), para (Parar), reseta;
// - aplica o limite de tempo (padrão 30 min) antes do carrinho;
// - cão de guarda: se a aba parar de responder (erro de rede, página travada),
//   recarrega no ponto certo (produto antes do carrinho, carrinho depois);
// - nunca fecha a aba.
importScripts("comum.js");

const { STATUS, ATIVOS, PROTEGIDOS, URLS } = GH;
const ALARME_GUARDA = "guarda";
const ALARME_PRAZO = "prazo";
const HEARTBEAT_LIMITE_MS = 45_000;
const MAX_LOG = 250;

// ---------------------------------------------------------------- estado ----
async function lerTudo() {
  const { config, run } = await chrome.storage.local.get(["config", "run"]);
  return { config: { ...GH.CONFIG_PADRAO, ...(config || {}) }, run: run || null };
}

let fila = Promise.resolve();
// Serializa todas as mutações para não haver corrida entre mensagens.
function mutar(fn) {
  const passo = fila.then(async () => {
    const { run } = await lerTudo();
    const novo = await fn(run);
    if (novo === undefined) return run;
    const jaProtegido = Boolean(run?.carrinhoProtegido && novo && run.productId === novo.productId);
    if (novo) {
      // Proteção do carrinho é "monotônica" para o mesmo produto: só a Nova monitoração desfaz.
      novo.carrinhoProtegido = Boolean(jaProtegido || novo.carrinhoProtegido || PROTEGIDOS.has(novo.status));
      if (novo.carrinhoProtegido && !jaProtegido && !novo.carrinhoConfirmadoEm) {
        novo.carrinhoConfirmadoEm = Date.now();
      }
    }
    await chrome.storage.local.set({ run: novo });
    await aoMudarStatus(run, novo);
    return novo;
  });
  fila = passo.catch((e) => console.error("[GH] mutar", e));
  return passo;
}

function comLog(run, msg, nivel = "info") {
  const log = [...(run.log || []), { t: Date.now(), nivel, msg }].slice(-MAX_LOG);
  console.log(`[GH ${GH.hora()}] ${nivel.toUpperCase()}: ${msg}`);
  return { ...run, log };
}

// -------------------------------------------------------- efeitos de status --
const BADGE = {
  [STATUS.MONITORANDO]: ["MON", "#2563eb"],
  [STATUS.DISPONIVEL]: ["!", "#f59e0b"],
  [STATUS.ADICIONANDO_AO_CARRINHO]: ["...", "#f59e0b"],
  [STATUS.PRODUTO_NO_CARRINHO]: ["CART", "#f97316"],
  [STATUS.PREENCHENDO_CEP]: ["CEP", "#f97316"],
  [STATUS.AGUARDANDO_FRETE]: ["FRT", "#f97316"],
  [STATUS.FRETE_SELECIONADO]: ["FRT", "#f97316"],
  [STATUS.FINALIZANDO_CHECKOUT]: ["FIN", "#f97316"],
  [STATUS.ERRO_RECUPERAVEL]: ["ERR", "#f97316"],
  [STATUS.AGUARDANDO_USUARIO]: ["OK", "#16a34a"],
  [STATUS.ERRO_MANUAL]: ["ERR", "#dc2626"],
  [STATUS.TEMPO_ESGOTADO]: ["30m", "#6b7280"],
};

const NOTIFICAR = {
  [STATUS.PRODUTO_NO_CARRINHO]: "🔥 Produto no carrinho!",
  [STATUS.AGUARDANDO_USUARIO]: "Checkout preparado. Assuma a aba para pagar.",
  [STATUS.ERRO_MANUAL]: "A automação precisa de você. Veja o painel.",
  [STATUS.TEMPO_ESGOTADO]: "Tempo limite atingido sem liberar o produto. Monitoramento encerrado.",
};

async function aoMudarStatus(antes, depois) {
  const status = depois?.status;
  const [texto, cor] = BADGE[status] || ["", "#000000"];
  await chrome.action.setBadgeText({ text: texto });
  await chrome.action.setBadgeBackgroundColor({ color: cor });

  if (!status || !ATIVOS.has(status)) {
    await chrome.alarms.clear(ALARME_GUARDA);
    await chrome.alarms.clear(ALARME_PRAZO);
  }
  if (status && status !== antes?.status && NOTIFICAR[status]) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "GamerHut AutoBuy",
      message: NOTIFICAR[status],
      priority: 2,
      requireInteraction: status !== STATUS.PRODUTO_NO_CARRINHO,
    });
  }
}

// ------------------------------------------------------------- iniciar ------
async function enviarParaAba(tabId, msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    // Aba aberta antes da instalação da extensão: injeta o content script.
    await chrome.scripting.executeScript({ target: { tabId }, files: ["comum.js", "content.js"] });
    return await chrome.tabs.sendMessage(tabId, msg);
  }
}

function navegarEEsperar(tabId, url, ms = 30_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(ouvir);
      reject(new Error("a página demorou para carregar"));
    }, ms);
    function ouvir(id, info) {
      if (id !== tabId || info.status !== "complete") return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(ouvir);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(ouvir);
    chrome.tabs.update(tabId, { url }).catch((e) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(ouvir);
      reject(e);
    });
  });
}

async function iniciar(tabId) {
  const { config, run } = await lerTudo();
  if (run && ATIVOS.has(run.status)) return { ok: false, erro: "A automação já está em execução." };

  if (!(await chrome.tabs.get(tabId).catch(() => null))) {
    return { ok: false, erro: "Nenhuma aba ativa encontrada." };
  }
  if (config.prepararCheckout && !/^\d{8}$/.test(config.cep)) {
    return { ok: false, erro: "Configure um CEP válido (8 dígitos) antes de iniciar." };
  }

  // Sem validar a aba atual: ela é levada SEMPRE à URL informada na configuração.
  let pre;
  try {
    await navegarEEsperar(tabId, config.productUrl);
    pre = await enviarParaAba(tabId, { type: "preflight", productId: config.productId });
  } catch (e) {
    return { ok: false, erro: `Não consegui abrir/ler a URL configurada (${e.message}).` };
  }
  // A URL configurada é a fonte da verdade: o ID do produto vem da própria página.
  if (!pre.productIdPagina && !config.productId) {
    return { ok: false, erro: "Não encontrei um produto na URL configurada. Confira a URL." };
  }
  if (pre.productIdPagina && pre.productIdPagina !== config.productId) {
    config.productId = pre.productIdPagina;
    await chrome.storage.local.set({ config });
    pre.qtdCarrinho = await enviarParaAba(tabId, { type: "preflight", productId: config.productId })
      .then((p) => p.qtdCarrinho).catch(() => null);
  }
  if (config.exigirLogin && !pre.logado) {
    return { ok: false, erro: "Sessão não detectada: faça login na Gamer Hut nesta aba e tente de novo.", pre };
  }
  if (pre.qtdCarrinho === null || pre.qtdCarrinho === undefined) {
    return { ok: false, erro: "Não consegui ler o carrinho. Tente de novo em alguns segundos.", pre };
  }

  const agora = Date.now();
  const base = {
    tabId,
    productUrl: config.productUrl,
    productId: config.productId,
    iniciadoEm: agora,
    prazo: agora + config.maxMinutes * 60_000,
    heartbeat: agora,
    tentativasCompra: 0,
    tentativasCheckout: 0,
    recuperacoes: 0,
    verificacoes: 0,
    sessaoOk: Boolean(pre.logado),
    abaOk: true,
    etapas: {},
    log: run?.productId === config.productId ? run.log || [] : [],
  };

  // Recuperação: o carrinho REAL tem prioridade sobre o estado salvo.
  if (pre.qtdCarrinho >= 1) {
    await mutar(() => comLog(
      { ...base, status: STATUS.PRODUTO_NO_CARRINHO, carrinhoProtegido: true, etapas: { produto: true } },
      `Produto já está no carrinho (qtd ${pre.qtdCarrinho}): Comprar NÃO será clicado; seguindo para o checkout`,
    ));
    await armarAlarmes(null);
    await chrome.tabs.update(tabId, { url: URLS.carrinho });
    return { ok: true };
  }

  if (run?.carrinhoProtegido && run.productId === config.productId) {
    await mutar((r) => comLog({ ...r, status: STATUS.ERRO_MANUAL },
      "O estado salvo diz que o produto já esteve no carrinho, mas o carrinho está vazio " +
      "(pedido já feito? item removido?). Não vou comprar de novo. Use \"Nova monitoração\" se tiver certeza.",
      "erro"));
    return { ok: false, erro: "Produto já esteve no carrinho e sumiu. Veja a atividade; use Nova monitoração se tiver certeza." };
  }

  await mutar(() => comLog(
    { ...base, status: STATUS.MONITORANDO, carrinhoProtegido: false },
    `Monitoramento iniciado (a cada ${config.pollSeconds}s, limite ${config.maxMinutes} min): ${config.productUrl}`,
  ));
  await armarAlarmes(base.prazo);
  // Garante a URL exata configurada (com UTM) e dispara o primeiro ciclo.
  await chrome.tabs.update(tabId, { url: config.productUrl });
  return { ok: true };
}

async function armarAlarmes(prazo) {
  await chrome.alarms.create(ALARME_GUARDA, { periodInMinutes: 0.5 });
  if (prazo) await chrome.alarms.create(ALARME_PRAZO, { when: prazo });
}

async function parar(motivo, status = STATUS.PARADO) {
  return mutar((run) => {
    if (!run || !ATIVOS.has(run.status)) return undefined;
    return comLog({ ...run, status }, motivo, status === STATUS.PARADO ? "aviso" : "info");
  });
}

// ---------------------------------------------------------- cão de guarda ---
async function verificarSaude() {
  const { config, run } = await lerTudo();
  if (!run || !ATIVOS.has(run.status)) {
    await chrome.alarms.clear(ALARME_GUARDA);
    return;
  }
  if (!run.carrinhoProtegido && Date.now() > run.prazo) {
    await parar(`Tempo limite de ${config.maxMinutes} min atingido sem liberar o produto. Monitoramento encerrado.`,
      STATUS.TEMPO_ESGOTADO);
    return;
  }
  const tab = await chrome.tabs.get(run.tabId).catch(() => null);
  if (!tab) {
    await parar("A aba monitorada foi fechada. Automação parada.");
    return;
  }
  const semResposta = Date.now() - (run.heartbeat || 0);
  if (semResposta < HEARTBEAT_LIMITE_MS) return;

  if ((run.recuperacoes || 0) >= 10) {
    await mutar((r) => comLog({ ...r, status: STATUS.ERRO_MANUAL },
      "A aba parou de responder várias vezes. Automação parada; continue manualmente.", "erro"));
    return;
  }
  // Depois do carrinho (ou com clique pendente) a recuperação é SEMPRE pelo carrinho.
  const destino = run.carrinhoProtegido || run.status === STATUS.ADICIONANDO_AO_CARRINHO
    ? URLS.carrinho : run.productUrl;
  await mutar((r) => comLog({ ...r, recuperacoes: (r.recuperacoes || 0) + 1, heartbeat: Date.now() },
    `Aba sem resposta há ${Math.round(semResposta / 1000)}s; recarregando ${destino === URLS.carrinho ? "o carrinho" : "o produto"}`,
    "aviso"));
  await chrome.tabs.update(run.tabId, { url: destino });
}

chrome.alarms.onAlarm.addListener((alarme) => {
  if (alarme.name === ALARME_GUARDA || alarme.name === ALARME_PRAZO) verificarSaude();
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { run } = await lerTudo();
  if (run?.tabId === tabId) await parar("A aba monitorada foi fechada. Automação parada.");
});

// ------------------------------------------------------------- mensagens ----
chrome.runtime.onMessage.addListener((msg, sender, responder) => {
  (async () => {
    switch (msg.type) {
      case "whoami":
        return { tabId: sender.tab?.id };

      case "start":
        return iniciar(msg.tabId);

      case "stop":
        await parar("Parado pelo usuário. A aba não foi alterada.");
        return { ok: true };

      case "reset": {
        const { run } = await lerTudo();
        if (run && ATIVOS.has(run.status)) return { ok: false, erro: "Pare a automação antes de iniciar uma nova monitoração." };
        await mutar(() => null);
        return { ok: true };
      }

      case "patch": {
        // Só aceita atualizações da aba em execução e enquanto a execução está ativa:
        // uma página antiga não consegue "ressuscitar" a automação depois do Parar.
        const novo = await mutar((run) => {
          if (!run || run.tabId !== sender.tab?.id || !ATIVOS.has(run.status)) return undefined;
          let r = { ...run, ...msg.patch, heartbeat: Date.now() };
          if (msg.patch?.etapas) r.etapas = { ...run.etapas, ...msg.patch.etapas };
          if (msg.log) r = comLog(r, msg.log, msg.nivel);
          return r;
        });
        return { ok: true, run: novo };
      }

      default:
        return { ok: false, erro: "mensagem desconhecida" };
    }
  })().then(responder, (e) => responder({ ok: false, erro: e.message }));
  return true; // resposta assíncrona
});

chrome.runtime.onStartup.addListener(async () => {
  // Chrome reaberto: uma execução "ativa" antiga não tem mais aba. Para com segurança.
  await parar("Chrome reiniciado durante a execução. Inicie de novo na aba do produto.");
});
