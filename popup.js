const { STATUS: ST, ATIVOS, PRESETS } = GH;
const $ = (id) => document.getElementById(id);

// Ícones Lucide (MIT), traço 24x24.
const ICONES = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  stop: '<rect width="14" height="14" x="5" y="5" rx="2"/>',
  config: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  voltar: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  carrinho: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  pino: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  caminhao: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  cartao: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  olho: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  aba: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  carregando: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  pausa: '<circle cx="12" cy="12" r="10"/><line x1="10" x2="10" y1="15" y2="9"/><line x1="14" x2="14" y1="15" y2="9"/>',
  pronto: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
};
const svg = (nome, classe = "") =>
  `<svg class="${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome]}</svg>`;

let cfg = { ...GH.CONFIG_PADRAO };
let run = null;
let confirmandoNovo = false;

// Uma execução antiga de OUTRO produto (ex.: o teste) não aparece no painel.
function execucaoVisivel(bruto) {
  if (!bruto) return null;
  if (ATIVOS.has(bruto.status)) return bruto;
  const mesmo = bruto.productUrl === cfg.productUrl || (cfg.productId && bruto.productId === cfg.productId);
  return mesmo ? bruto : null;
}
let abaAtiva = null;
let iniciando = false;
let erroInicio = null;

// ================================================================== dados ===
async function carregar() {
  const dados = await chrome.storage.local.get(["config", "run"]);
  cfg = { ...GH.CONFIG_PADRAO, ...(dados.config || {}) };
  run = execucaoVisivel(dados.run || null);
  [abaAtiva] = await chrome.tabs.query({ active: true, currentWindow: true });
  render();
}

chrome.storage.onChanged.addListener((mud, area) => {
  if (area !== "local") return;
  if (mud.config) cfg = { ...GH.CONFIG_PADRAO, ...(mud.config.newValue || {}) };
  if (mud.run || mud.config) {
    chrome.storage.local.get("run").then((d) => { run = execucaoVisivel(d.run || null); render(); });
    return;
  }
  render();
});

const ativo = () => Boolean(run && ATIVOS.has(run.status));
const doProduto = () => Boolean(run && (run.productUrl === cfg.productUrl || run.productId === cfg.productId));
const protegido = () => doProduto() && Boolean(run.carrinhoProtegido);
const precisaCep = () => cfg.prepararCheckout && !/^\d{8}$/.test(cfg.cep || "");
const formatarCep = (c) => (c || "").replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");

function nomeProduto() {
  const p = Object.values(PRESETS).find((x) => x.productUrl === cfg.productUrl);
  if (p) return p.nome;
  try {
    const slug = new URL(cfg.productUrl).pathname.replace(/^\/|\/$/g, "").replace(/-/g, " ");
    return slug ? slug[0].toUpperCase() + slug.slice(1) : cfg.productUrl;
  } catch { return "URL personalizada"; }
}

// ============================================================ status hero ===
function estadoHero() {
  const s = run?.status || ST.IDLE;
  const seg = cfg.pollSeconds;
  switch (s) {
    case ST.MONITORANDO:
      return { tom: "info", icone: "olho", pulso: 1, titulo: "Monitorando a pré-venda",
        sub: `A página recarrega a cada ${seg}s até o botão Comprar aparecer.` };
    case ST.DISPONIVEL:
    case ST.ADICIONANDO_AO_CARRINHO:
      return { tom: "andamento", icone: "carrinho", pulso: 1, titulo: "Produto liberado!",
        sub: "Adicionando ao carrinho…" };
    case ST.PRODUTO_NO_CARRINHO:
      return { tom: "andamento", icone: "carrinho", pulso: 1, titulo: "Produto no carrinho",
        sub: cfg.prepararCheckout ? "Preparando o checkout…" : "Conferindo o carrinho…" };
    case ST.PREENCHENDO_CEP:
    case ST.AGUARDANDO_FRETE:
      return { tom: "andamento", icone: "caminhao", pulso: 1, titulo: "Calculando o frete",
        sub: s === ST.PREENCHENDO_CEP ? "Preenchendo o CEP…" : "Aguardando as opções de entrega…" };
    case ST.FRETE_SELECIONADO:
    case ST.FINALIZANDO_CHECKOUT:
      return { tom: "andamento", icone: "cartao", pulso: 1, titulo: "Abrindo o checkout",
        sub: run?.frete ? `Frete: ${run.frete}` : "Clicando em Finalizar compra…" };
    case ST.ERRO_RECUPERAVEL:
      return { tom: "andamento", icone: "reset", pulso: 1, titulo: "Tentando de novo",
        sub: protegido()
          ? "Houve um erro no checkout. O produto continua no seu carrinho."
          : "Houve um erro. A extensão continua tentando até você clicar em Parar." };
    case ST.AGUARDANDO_USUARIO:
      return { tom: "sucesso", icone: "pronto", titulo: "Sua vez: conclua o pagamento",
        sub: cfg.prepararCheckout
          ? "O checkout está aberto na aba. A extensão parou e não mexe no pagamento."
          : "O produto está no carrinho. Finalize a compra na aba." };
    case ST.ERRO_MANUAL:
      return { tom: "perigo", icone: "alerta", titulo: "A extensão precisa de você",
        sub: protegido() ? "O produto foi protegido e nada foi desfeito." : "A automação parou com segurança." };
    case ST.TEMPO_ESGOTADO:
      return { tom: "neutro", icone: "relogio", titulo: "Tempo esgotado",
        sub: `O produto não foi liberado em ${cfg.maxMinutes} min. Nada foi comprado.` };
    case ST.PARADO:
      return protegido()
        ? { tom: "andamento", icone: "pausa", titulo: "Pausado com produto no carrinho",
            sub: "Clique em Continuar para retomar o checkout. Comprar não será clicado de novo." }
        : { tom: "neutro", icone: "pausa", titulo: "Parado", sub: "Você interrompeu. A aba não foi alterada." };
    default:
      return { tom: "neutro", icone: "play", titulo: "Pronto para iniciar",
        sub: "Ao iniciar, a aba atual abre o produto configurado e o monitoramento começa." };
  }
}

// ================================================================= etapas ===
function renderEtapas() {
  const lista = [
    { rot: "Monitorar", icone: "olho" },
    { rot: "Carrinho", icone: "carrinho" },
    { rot: "CEP", icone: "pino" },
    { rot: "Frete", icone: "caminhao" },
    { rot: "Checkout", icone: "cartao" },
  ].slice(0, cfg.prepararCheckout ? 5 : 2);

  const s = run?.status || ST.IDLE;
  const e = (doProduto() && run?.etapas) || {};
  let feitas = 0;
  let atual = -1;
  let erro = false;

  const porStatus = {
    [ST.MONITORANDO]: 0, [ST.DISPONIVEL]: 1, [ST.ADICIONANDO_AO_CARRINHO]: 1,
    [ST.PRODUTO_NO_CARRINHO]: 2, [ST.PREENCHENDO_CEP]: 2, [ST.AGUARDANDO_FRETE]: 3,
    [ST.FRETE_SELECIONADO]: 4, [ST.FINALIZANDO_CHECKOUT]: 4,
  };
  if (s in porStatus) {
    atual = porStatus[s];
    feitas = atual;
  } else if (s === ST.AGUARDANDO_USUARIO) {
    feitas = lista.length;
  } else if (protegido()) {
    feitas = 2 + (e.cep ? 1 : 0) + (e.frete ? 1 : 0);
    atual = feitas;
    erro = s === ST.ERRO_MANUAL || s === ST.ERRO_RECUPERAVEL;
  } else if (s === ST.ERRO_MANUAL || s === ST.TEMPO_ESGOTADO || s === ST.ERRO_RECUPERAVEL) {
    atual = 0;
    erro = true;
  }

  $("etapas").innerHTML = lista.map((etapa, i) => {
    const classe = i < feitas ? "feita" : i === atual ? (erro ? "erro" : "atual") : "";
    const icone = i < feitas ? "check" : i === atual && erro ? "x" : etapa.icone;
    const estado = { feita: "concluída", atual: "em andamento", erro: "com problema" }[classe] || "pendente";
    return `<li class="etapa ${classe}" aria-label="${etapa.rot}: ${estado}">
      <span class="bola">${svg(icone)}</span><span>${etapa.rot}</span></li>`;
  }).join("");
}

// ============================================================= checklist ===
function renderChecklist() {
  const mostrar = !ativo() && !protegido() && run?.status !== ST.AGUARDANDO_USUARIO;
  $("checklist").classList.toggle("hidden", !mostrar);
  if (!mostrar) return;

  const itens = [];
  if (cfg.prepararCheckout) {
    itens.push(precisaCep()
      ? { cls: "falta", icone: "x", texto: "CEP não configurado", acao: "Configurar" }
      : { cls: "ok", icone: "check", texto: `Entrega no CEP ${formatarCep(cfg.cep)}` });
  } else {
    itens.push({ cls: "info", icone: "info", texto: "Checkout manual: para ao entrar no carrinho" });
  }
  itens.push({ cls: "ok", icone: "check", texto: `Para sozinho após ${cfg.maxMinutes} min sem liberar` });
  itens.push({ cls: "info", icone: "info", texto: "Login na Gamer Hut é conferido ao iniciar" });

  $("checklist").innerHTML = itens.map((i) =>
    `<li class="${i.cls}">${svg(i.icone)}<span>${i.texto}</span>${i.acao ? `<button type="button" data-acao="config">${i.acao}</button>` : ""}</li>`,
  ).join("");
}

// ================================================================ alertas ===
function renderAlerta() {
  const s = run?.status;
  let texto = null;
  let tom = "perigo";
  const acoes = [];

  if (confirmandoNovo) {
    tom = "andamento";
    texto = run?.carrinhoProtegido
      ? "Isso limpa o status e a proteção desta execução. Se o produto ainda estiver no carrinho da loja, " +
        "ao iniciar a extensão o detecta e vai direto ao checkout, sem comprar de novo."
      : "Isso limpa o status e a atividade desta execução.";
    acoes.push({ id: "confirmarNovo", icone: "reset", rot: "Sim, recomeçar" });
    acoes.push({ id: "cancelarNovo", icone: "x", rot: "Cancelar" });
  } else if (erroInicio) {
    texto = erroInicio;
  } else if (s === ST.ERRO_MANUAL) {
    texto = run.ultimoErro || ultimoLog("erro") || "Veja a atividade para detalhes.";
    acoes.push({ id: "aba", icone: "aba", rot: "Ir para a aba" });
  } else if (s === ST.ERRO_RECUPERAVEL) {
    tom = "andamento";
    texto = protegido() && run.tentativasCheckout
      ? `${run.ultimoErro || "Erro no checkout"} (tentativa ${run.tentativasCheckout}).`
      : `${run.ultimoErro || "Erro"}.`;
  } else if (s === ST.PARADO && protegido()) {
    tom = "andamento";
    texto = "Se você já concluiu o pedido, não clique em Continuar.";
  }

  $("alerta").classList.toggle("hidden", !texto);
  if (!texto) return;
  $("alerta").dataset.tom = tom;
  $("alertaIcone").innerHTML = svg(tom === "perigo" ? "alerta" : "info");
  $("alertaTexto").textContent = texto;
  $("alertaAcoes").innerHTML = acoes.map((a) =>
    `<button type="button" data-acao="${a.id}">${svg(a.icone)}${a.rot}</button>`).join("");
}

// ================================================================= botões ===
function renderBotoes() {
  const p = $("acaoPrincipal");
  const sec = $("acaoSecundaria");
  const s = run?.status;
  sec.classList.add("hidden");
  p.className = "btn btn-primario";
  p.disabled = false;

  if (iniciando) {
    p.innerHTML = `${svg("carregando", "gira")}Abrindo o produto…`;
    p.disabled = true;
    p.dataset.acao = "";
  } else if (ativo()) {
    p.className = "btn btn-perigo";
    p.innerHTML = `${svg("stop")}Parar`;
    p.dataset.acao = "parar";
    if (abaAtiva?.id !== run.tabId) mostrarSecundaria("aba", "aba", "Ir para a aba da automação");
  } else if (s === ST.AGUARDANDO_USUARIO && doProduto()) {
    p.innerHTML = `${svg("aba")}Ir para a aba do checkout`;
    p.dataset.acao = "aba";
  } else if (protegido()) {
    p.innerHTML = `${svg("play")}Continuar checkout`;
    p.dataset.acao = "iniciar";
    p.disabled = precisaCep();
  } else {
    p.innerHTML = `${svg("play")}Iniciar monitoramento`;
    p.dataset.acao = "iniciar";
    p.disabled = precisaCep();
  }
  if (!iniciando && !ativo() && run && !confirmandoNovo) {
    mostrarSecundaria("novo", "reset", "Nova monitoração");
  }

  function mostrarSecundaria(acao, icone, rot) {
    sec.innerHTML = `${svg(icone)}${rot}`;
    sec.dataset.acao = acao;
    sec.classList.remove("hidden");
  }
}

// ================================================================== tempo ===
function renderTempo() {
  const s = run?.status;
  const mostrar = run && !run.carrinhoProtegido && run.prazo &&
    [ST.MONITORANDO, ST.DISPONIVEL, ST.ADICIONANDO_AO_CARRINHO].includes(s);
  $("tempo").classList.toggle("hidden", !mostrar);
  if (!mostrar) return;

  const total = run.prazo - run.iniciadoEm;
  const resta = Math.max(0, run.prazo - Date.now());
  const seg = Math.round(resta / 1000);
  $("tempoValor").textContent = `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
  $("tempoBarra").style.width = `${total > 0 ? (resta / total) * 100 : 0}%`;
  $("tempoBarra").parentElement.setAttribute("aria-valuenow", String(Math.round((resta / total) * 100)));

  const n = run.verificacoes || 0;
  const ha = run.ultimaVerificacao ? Math.max(0, Math.round((Date.now() - run.ultimaVerificacao) / 1000)) : null;
  $("tempoInfo").textContent = n
    ? `${n} ${n === 1 ? "verificação" : "verificações"} · última há ${ha}s`
    : "Primeira verificação em instantes…";
}

// ============================================================== atividade ===
function encurtar(msg) {
  return msg.replace(/https?:\/\/(?:www\.)?gamerhut\.com\.br(\/[^\s?]*)(\?\S*)?/g,
    (_, caminho, query) => `…${caminho.length > 34 ? caminho.slice(0, 32) + "…" : caminho}${query ? " (com UTM)" : ""}`);
}

function renderAtividade() {
  const log = run?.log || [];
  // Agrupa mensagens repetidas em sequência ("Produto indisponível ×12").
  const grupos = [];
  for (const item of log) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.msg === item.msg) {
      ultimo.n += 1;
      ultimo.t = item.t;
    } else {
      grupos.push({ ...item, n: 1 });
    }
  }
  $("atividadeQtd").textContent = String(log.length);
  const ol = $("log");
  ol.innerHTML = "";
  if (!grupos.length) {
    ol.innerHTML = '<li class="log-vazio">Nenhuma atividade ainda.</li>';
    return;
  }
  for (const g of grupos.reverse().slice(0, 80)) {
    const li = document.createElement("li");
    const t = document.createElement("time");
    t.textContent = GH.hora(g.t);
    const span = document.createElement("span");
    span.className = g.nivel === "info" ? "" : g.nivel;
    span.textContent = encurtar(g.msg);
    if (g.n > 1) {
      const rep = document.createElement("span");
      rep.className = "rep";
      rep.textContent = `×${g.n}`;
      span.append(rep);
    }
    li.append(t, span);
    ol.append(li);
  }
}

function ultimoLog(nivel) {
  return [...(run?.log || [])].reverse().find((l) => l.nivel === nivel)?.msg;
}

// ================================================================= render ===
function render() {
  $("produtoNome").textContent = nomeProduto();
  $("produtoNome").title = cfg.productUrl;

  const h = estadoHero();
  $("hero").dataset.tom = h.tom;
  $("hero").dataset.pulso = h.pulso ? "1" : "0";
  $("heroIcone").innerHTML = svg(h.icone);
  $("heroTitulo").textContent = h.titulo;
  $("heroSub").textContent = h.sub;

  renderTempo();
  renderEtapas();
  renderChecklist();
  renderAlerta();
  renderBotoes();
  renderAtividade();
}

// ================================================================== ações ===
async function executar(acao) {
  if (acao === "iniciar") {
    erroInicio = null;
    iniciando = true;
    render();
    [abaAtiva] = await chrome.tabs.query({ active: true, currentWindow: true });
    const r = await chrome.runtime.sendMessage({ type: "start", tabId: abaAtiva?.id }).catch((e) => ({ erro: e.message }));
    iniciando = false;
    if (!r?.ok) erroInicio = r?.erro || "Não foi possível iniciar.";
    await carregar();
  } else if (acao === "parar") {
    await chrome.runtime.sendMessage({ type: "stop" });
    await carregar();
  } else if (acao === "aba" && run?.tabId) {
    const tab = await chrome.tabs.update(run.tabId, { active: true }).catch(() => null);
    if (tab) {
      await chrome.windows.update(tab.windowId, { focused: true });
      window.close();
    } else {
      erroInicio = "A aba da automação não existe mais.";
      render();
    }
  } else if (acao === "novo") {
    confirmandoNovo = true;
    erroInicio = null;
    render();
  } else if (acao === "cancelarNovo") {
    confirmandoNovo = false;
    render();
  } else if (acao === "confirmarNovo") {
    const r = await chrome.runtime.sendMessage({ type: "reset" });
    confirmandoNovo = false;
    erroInicio = r?.ok ? null : r?.erro;
    await carregar();
    if (r?.ok) toast("Pronto para uma nova monitoração");
  } else if (acao === "config") {
    abrirConfig();
  }
}

document.addEventListener("click", (ev) => {
  const alvo = ev.target.closest("[data-acao]");
  if (alvo && !alvo.disabled && alvo.dataset.acao) executar(alvo.dataset.acao);
});

function toast(texto) {
  $("toast").textContent = texto;
  $("toast").classList.remove("hidden");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $("toast").classList.add("hidden"), 1800);
}

// ========================================================== configurações ===
const OPCOES = [
  { id: "ocarina", titulo: "Zelda: Ocarina of Time", sub: "Switch 2 · pré-venda (link com UTM)" },
  { id: "links", titulo: "Zelda: Link's Awakening", sub: "Produto disponível, para testar o fluxo", tag: "TESTE" },
  { id: "custom", titulo: "Outro produto", sub: "Informe a URL do produto" },
];

function abrirConfig() {
  const selecionado = Object.entries(PRESETS).find(([, p]) => p.productUrl === cfg.productUrl)?.[0] || "custom";
  $("opcoesProduto").innerHTML = OPCOES.map((o) => `
    <label class="opcao">
      <input type="radio" name="produto" value="${o.id}" ${o.id === selecionado ? "checked" : ""}>
      <span><strong>${o.titulo}${o.tag ? `<span class="tag">${o.tag}</span>` : ""}</strong><small>${o.sub}</small></span>
    </label>`).join("");
  $("productUrl").value = selecionado === "custom" ? cfg.productUrl : "";
  $("productUrl").removeAttribute("aria-invalid");
  $("cep").value = formatarCep(cfg.cep);
  $("pollSeconds").value = cfg.pollSeconds;
  $("maxMinutes").value = cfg.maxMinutes;
  $("prepararCheckout").checked = cfg.prepararCheckout;
  $("cepErro").classList.add("hidden");
  $("cep").removeAttribute("aria-invalid");
  atualizarCampoUrl();

  const bloqueada = ativo();
  $("configBloqueada").classList.toggle("hidden", !bloqueada);
  $("form").querySelectorAll("fieldset, button").forEach((el) => { el.disabled = bloqueada; });

  $("viewPainel").classList.add("hidden");
  $("viewConfig").classList.remove("hidden");
}

function fecharConfig() {
  $("viewConfig").classList.add("hidden");
  $("viewPainel").classList.remove("hidden");
  render();
}

function produtoEscolhido() {
  return $("opcoesProduto").querySelector("input:checked")?.value || "custom";
}

function atualizarCampoUrl() {
  $("urlCampo").classList.toggle("hidden", produtoEscolhido() !== "custom");
}

$("opcoesProduto").addEventListener("change", atualizarCampoUrl);
$("productUrl").addEventListener("input", () => $("productUrl").removeAttribute("aria-invalid"));
$("cep").addEventListener("input", () => {
  $("cep").value = formatarCep($("cep").value);
  $("cepErro").classList.add("hidden");
  $("cep").removeAttribute("aria-invalid");
});

$("form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (ativo()) return;
  const escolha = produtoEscolhido();
  const productUrl = escolha === "custom" ? $("productUrl").value.trim() : PRESETS[escolha].productUrl;
  try { new URL(productUrl); } catch {
    $("productUrl").setAttribute("aria-invalid", "true");
    $("productUrl").focus();
    return;
  }
  const cep = $("cep").value.replace(/\D/g, "");
  const prepararCheckout = $("prepararCheckout").checked;
  if ((cep && cep.length !== 8) || (prepararCheckout && cep.length !== 8)) {
    $("cepErro").classList.remove("hidden");
    $("cep").setAttribute("aria-invalid", "true");
    $("cep").focus();
    return;
  }
  const novo = {
    ...cfg,
    preset: escolha,
    productUrl,
    // O ID não é pedido: é lido da página da URL ao iniciar.
    productId: productUrl === cfg.productUrl ? cfg.productId : (PRESETS[escolha]?.productId || ""),
    cep,
    prepararCheckout,
    pollSeconds: Math.min(40, Math.max(3, Number($("pollSeconds").value) || 10)),
    maxMinutes: Math.min(240, Math.max(1, Number($("maxMinutes").value) || 30)),
  };
  await chrome.storage.local.set({ config: novo });
  cfg = novo;
  erroInicio = null;
  fecharConfig();
  toast("Configurações salvas");
});

$("abrirConfig").innerHTML = svg("config");
$("voltar").innerHTML = svg("voltar");
$("abrirConfig").addEventListener("click", abrirConfig);
$("voltar").addEventListener("click", fecharConfig);

setInterval(renderTempo, 1000);
carregar();
