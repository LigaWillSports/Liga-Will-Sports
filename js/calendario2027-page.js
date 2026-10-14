const DIVISAO_CLASSE = { 1: "prime", 2: "pro", 3: "rise" };

function formatDateBR(dateIso) {
    const [y, m, d] = dateIso.split("-");
    return `${d}/${m}/${y}`;
}

function formatDateCurta(dateIso) {
    const [, m, d] = dateIso.split("-");
    return `${d}/${m}`;
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

function todayIso() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Monta o mapa número -> equipe (com a divisão), usando "A definir" para vagas sem nome. */
function buildEquipes(divisoes) {
    const equipes = new Map();
    divisoes.forEach((divisao) => {
        divisao.equipes.forEach((equipe) => {
            equipes.set(equipe.numero, {
                numero: equipe.numero,
                nome: equipe.nome || "A definir",
                definida: Boolean(equipe.nome),
                divisao
            });
        });
    });
    return equipes;
}

function divisaoClasse(divisao) {
    return DIVISAO_CLASSE[divisao.id] || "prime";
}

function teamLabel(equipe) {
    const cls = equipe.definida ? "cal-team-name" : "cal-team-name tbd";
    return `<span class="team-num">${equipe.numero}</span><span class="${cls}">${escapeHtml(equipe.nome)}</span>`;
}

function renderResumo(divisoes, rodadas, equipes) {
    const totalJogos = rodadas.reduce((acc, r) => acc + r.jogos.length, 0);
    const confirmadas = Array.from(equipes.values()).filter((e) => e.definida).length;
    const inicio = rodadas[0] ? formatDateCurta(rodadas[0].data) : "—";
    const fim = rodadas.length ? formatDateCurta(rodadas[rodadas.length - 1].data) : "—";

    const items = [
        { valor: divisoes.length, rotulo: "Divisões" },
        { valor: `${confirmadas}/${equipes.size}`, rotulo: "Equipes" },
        { valor: rodadas.length, rotulo: "Rodadas" },
        { valor: totalJogos, rotulo: "Jogos" },
        { valor: `${inicio} – ${fim}`, rotulo: "Período" }
    ];

    document.getElementById("seasonSummary").innerHTML = items
        .map((item) => `
            <div class="summary-item">
                <div class="summary-value">${item.valor}</div>
                <div class="summary-label">${item.rotulo}</div>
            </div>
        `)
        .join("");
}

function renderDivisoes(divisoes, equipes) {
    document.getElementById("divisionsGrid").innerHTML = divisoes
        .map((divisao) => `
            <div class="division-card ${divisaoClasse(divisao)}">
                <div class="division-head">
                    <span class="division-name">${escapeHtml(divisao.nome)}</span>
                    <span class="division-tag">${escapeHtml(divisao.apelido)}</span>
                </div>
                <ol class="division-teams">
                    ${divisao.equipes
                        .map((e) => {
                            const equipe = equipes.get(e.numero);
                            return `
                                <li>
                                    <button type="button" class="division-team" data-equipe="${equipe.numero}">
                                        ${teamLabel(equipe)}
                                    </button>
                                </li>
                            `;
                        })
                        .join("")}
                </ol>
            </div>
        `)
        .join("");
}

function renderMatchCard(jogo, equipes) {
    const t1 = equipes.get(jogo[0]);
    const t2 = equipes.get(jogo[1]);
    if (!t1 || !t2) {
        return "";
    }
    return `
        <div class="cal-match">
            <div class="cal-team">${teamLabel(t1)}</div>
            <div class="vs-badge">VS</div>
            <div class="cal-team right">${teamLabel(t2)}</div>
        </div>
    `;
}

function renderRodada(rodada, divisoes, equipes, ativa) {
    const blocos = divisoes
        .map((divisao) => {
            const jogos = rodada.jogos.filter((j) => {
                const equipe = equipes.get(j[0]);
                return equipe && equipe.divisao.id === divisao.id;
            });
            const emJogo = new Set(jogos.flat());
            const folgas = divisao.equipes
                .filter((e) => !emJogo.has(e.numero))
                .map((e) => escapeHtml(equipes.get(e.numero).nome))
                .join(", ");

            return `
                <div class="round-division ${divisaoClasse(divisao)}">
                    <div class="round-division-title">
                        ${escapeHtml(divisao.nome)} <span class="division-tag">${escapeHtml(divisao.apelido)}</span>
                        <span class="round-division-count">${jogos.length} ${jogos.length === 1 ? "jogo" : "jogos"}</span>
                    </div>
                    <div class="cal-grid">
                        ${jogos.map((j) => renderMatchCard(j, equipes)).join("")}
                    </div>
                    ${folgas ? `<div class="folgas"><strong>Folgam:</strong> ${folgas}</div>` : ""}
                </div>
            `;
        })
        .join("");

    return `
        <div id="round${rodada.id}" class="round-section ${ativa ? "active" : ""}">
            <div class="round-header">
                <h2>Rodada ${rodada.id}</h2>
                <div class="date">${formatDateBR(rodada.data)} • ${rodada.jogos.length} jogos</div>
            </div>
            <div class="schedule-wrapper">${blocos}</div>
        </div>
    `;
}

function renderCalendario(rodadas, divisoes, equipes) {
    const hoje = todayIso();
    const proxima = rodadas.find((r) => r.data >= hoje) || rodadas[rodadas.length - 1];
    const ativaId = proxima ? proxima.id : null;

    document.getElementById("roundTabs").innerHTML = rodadas
        .map((rodada) => `
            <button type="button" class="round-tab ${rodada.id === ativaId ? "active" : ""}" data-rodada="${rodada.id}">
                Rodada ${rodada.id}
                <span class="round-tab-date">${formatDateCurta(rodada.data)}</span>
            </button>
        `)
        .join("");

    return rodadas.map((rodada) => renderRodada(rodada, divisoes, equipes, rodada.id === ativaId)).join("");
}

function renderEquipe(numero, rodadas, equipes) {
    const equipe = equipes.get(numero);
    const linhas = rodadas
        .map((rodada) => {
            const jogo = rodada.jogos.find((j) => j[0] === numero || j[1] === numero);
            const adversario = jogo ? equipes.get(jogo[0] === numero ? jogo[1] : jogo[0]) : null;
            return `
                <div class="team-game ${adversario ? "" : "bye"}">
                    <div class="tg-round">Rodada ${rodada.id}</div>
                    <div class="tg-date">${formatDateBR(rodada.data)}</div>
                    <div class="tg-opp">
                        ${adversario ? `<span class="tg-vs">vs</span> ${teamLabel(adversario)}` : "Folga"}
                    </div>
                </div>
            `;
        })
        .join("");
    const totalJogos = rodadas.filter((r) => r.jogos.some((j) => j.includes(numero))).length;

    return `
        <div class="round-section active team-view ${divisaoClasse(equipe.divisao)}">
            <div class="round-header">
                <h2>${escapeHtml(equipe.nome)}</h2>
                <div class="date">${escapeHtml(equipe.divisao.nome)} • ${escapeHtml(equipe.divisao.apelido)} • ${totalJogos} jogos</div>
            </div>
            <div class="schedule-wrapper">
                ${linhas}
                <button type="button" class="classification-tab team-view-close" data-limpar>Ver calendário completo</button>
            </div>
        </div>
    `;
}

function renderTeamFilter(divisoes, equipes) {
    document.getElementById("teamFilter").innerHTML =
        '<option value="">Todas as equipes (por rodada)</option>' +
        divisoes
            .map((divisao) => `
                <optgroup label="${escapeHtml(divisao.nome)} • ${escapeHtml(divisao.apelido)}">
                    ${divisao.equipes
                        .map((e) => {
                            const equipe = equipes.get(e.numero);
                            return `<option value="${equipe.numero}">${equipe.numero}. ${escapeHtml(equipe.nome)}</option>`;
                        })
                        .join("")}
                </optgroup>
            `)
            .join("");
}

async function initCalendario2027Page() {
    const [divisoes, calendario] = await Promise.all([
        fetchJsonSafe("data/2027/divisoes.json", []),
        fetchJsonSafe("data/2027/calendario.json", null)
    ]);
    if (!Array.isArray(divisoes) || !divisoes.length || !calendario || !Array.isArray(calendario.rodadas)) {
        throw new Error("Dados da temporada 2027 não encontrados.");
    }

    const equipes = buildEquipes(divisoes);
    const rodadas = [...calendario.rodadas].sort((a, b) => a.id - b.id);
    const roundTabs = document.getElementById("roundTabs");
    const roundsContainer = document.getElementById("roundsContainer");
    const teamFilter = document.getElementById("teamFilter");

    renderResumo(divisoes, rodadas, equipes);
    renderDivisoes(divisoes, equipes);
    renderTeamFilter(divisoes, equipes);
    document.getElementById("calendarNote").textContent = calendario.observacao || "";

    function mostrar(numero) {
        const valido = numero && equipes.has(numero);
        teamFilter.value = valido ? String(numero) : "";
        roundTabs.hidden = Boolean(valido);
        roundsContainer.innerHTML = valido
            ? renderEquipe(numero, rodadas, equipes)
            : renderCalendario(rodadas, divisoes, equipes);

        const abaAtiva = roundTabs.querySelector(".round-tab.active");
        if (abaAtiva && !valido) {
            roundTabs.scrollLeft = abaAtiva.offsetLeft - roundTabs.offsetLeft - 16;
        }

        const url = new URL(window.location.href);
        if (valido) {
            url.searchParams.set("equipe", numero);
        } else {
            url.searchParams.delete("equipe");
        }
        history.replaceState(null, "", url);
    }

    roundTabs.addEventListener("click", (event) => {
        const tab = event.target.closest(".round-tab");
        if (!tab) {
            return;
        }
        roundTabs.querySelectorAll(".round-tab").forEach((t) => t.classList.toggle("active", t === tab));
        roundsContainer.querySelectorAll(".round-section").forEach((section) => {
            section.classList.toggle("active", section.id === `round${tab.dataset.rodada}`);
        });
    });

    teamFilter.addEventListener("change", () => mostrar(Number(teamFilter.value)));

    document.getElementById("divisionsGrid").addEventListener("click", (event) => {
        const btn = event.target.closest(".division-team");
        if (!btn) {
            return;
        }
        mostrar(Number(btn.dataset.equipe));
        teamFilter.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    roundsContainer.addEventListener("click", (event) => {
        if (event.target.closest("[data-limpar]")) {
            mostrar(null);
        }
    });

    mostrar(Number(new URLSearchParams(window.location.search).get("equipe")));
}

initCalendario2027Page().catch((error) => {
    console.error(error);
    document.getElementById("roundsContainer").innerHTML =
        '<div class="round-section active"><div class="footer">Erro ao carregar a temporada 2027. Verifique os arquivos em /data/2027.</div></div>';
});
