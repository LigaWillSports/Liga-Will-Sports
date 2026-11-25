function formatDateBR(dateIso) {
    const [y, m, d] = dateIso.split("-");
    return `${d}/${m}/${y}`;
}

/**
 * Nos playoffs um lado do confronto pode ainda não ter dono: vem do vencedor de
 * outro jogo (time1_vencedorDe / time2_vencedorDe). Enquanto esse jogo de origem
 * não termina, mostramos o rótulo da vaga em vez do nome do time.
 */
function resolveLado(jogo, lado, teamById, jogoById, labelByJogoId) {
    const timeId = jogo[`time${lado}_id`];
    const seed = jogo[`time${lado}_seed`];
    if (timeId) {
        const time = teamById.get(timeId);
        return time ? { timeId, nome: time.nome, seed, definido: true } : null;
    }

    const origemId = jogo[`time${lado}_vencedorDe`];
    if (!origemId) {
        return null;
    }

    const origem = jogoById.get(origemId);
    const vencedorId = origem ? getWinnerId(origem) : null;
    if (vencedorId) {
        const time = teamById.get(vencedorId);
        if (time) {
            return { timeId: vencedorId, nome: time.nome, seed: undefined, definido: true };
        }
    }
    return { timeId: null, nome: `Vencedor ${labelByJogoId.get(origemId) || "a definir"}`, seed: undefined, definido: false };
}

function teamLabel(lado) {
    const seed = lado.seed ? `<span class="team-seed">${lado.seed}º</span> ` : "";
    return `${seed}${lado.nome}`;
}

function createMatchCard(jogo, teamById, jogoById, labelByJogoId) {
    const l1 = resolveLado(jogo, 1, teamById, jogoById, labelByJogoId);
    const l2 = resolveLado(jogo, 2, teamById, jogoById, labelByJogoId);
    if (!l1 || !l2) {
        return "";
    }

    const winner = getWinnerId(jogo);
    const finished = jogo.finalizado;
    const badge = finished ? "FIM" : jogo.horario;
    const badgeClass = finished ? "time-badge time-finished" : "time-badge";
    const fase = jogo.fase ? `<div class="match-fase">${jogo.fase}</div>` : "";

    if (finished) {
        const t1WinnerClass = winner === l1.timeId ? "team winner" : "team";
        const t2WinnerClass = winner === l2.timeId ? "team winner" : "team";
        const s1WinnerClass = winner === l1.timeId ? "score winner" : "score";
        const s2WinnerClass = winner === l2.timeId ? "score winner" : "score";
        return `
            <div class="match-card">
                ${fase}
                <div class="${badgeClass}">${badge}</div>
                <div class="${t1WinnerClass}">${teamLabel(l1)}</div>
                <div class="score-container">
                    <span class="${s1WinnerClass}">${jogo.placar.time1}</span>
                    <span class="score-divider">-</span>
                    <span class="${s2WinnerClass}">${jogo.placar.time2}</span>
                </div>
                <div class="${t2WinnerClass}">${teamLabel(l2)}</div>
                <a href="jogostats.html?jogoId=${encodeURIComponent(jogo.id)}" class="stats-btn">📊 Estatísticas</a>
            </div>
        `;
    }

    const t1Class = l1.definido ? "team" : "team team-indefinido";
    const t2Class = l2.definido ? "team" : "team team-indefinido";
    return `
        <div class="match-card">
            ${fase}
            <div class="${badgeClass}">${badge}</div>
            <div class="${t1Class}">${teamLabel(l1)}</div>
            <div class="vs-badge">VS</div>
            <div class="${t2Class}">${teamLabel(l2)}</div>
            <a href="jogostats.html?jogoId=${encodeURIComponent(jogo.id)}" class="stats-btn">📊 Estatísticas</a>
        </div>
    `;
}

/**
 * "Semifinal 1", "Semifinal 2", "Decisão da Vaga"... para nomear as vagas dos
 * confrontos seguintes. A numeração é por grupo, já que cada grupo tem a sua chave.
 */
function buildLabelByJogoId(jogos) {
    const chaveFase = (jogo) => `${jogo.grupo ?? ""}|${jogo.fase}`;

    const contagemPorFase = {};
    jogos.forEach((jogo) => {
        if (jogo.fase) {
            contagemPorFase[chaveFase(jogo)] = (contagemPorFase[chaveFase(jogo)] || 0) + 1;
        }
    });

    const labels = new Map();
    const vistosPorFase = {};
    jogos.forEach((jogo) => {
        if (!jogo.fase) {
            return;
        }
        const chave = chaveFase(jogo);
        vistosPorFase[chave] = (vistosPorFase[chave] || 0) + 1;
        const sufixo = contagemPorFase[chave] > 1 ? ` ${vistosPorFase[chave]}` : "";
        labels.set(jogo.id, `${jogo.fase}${sufixo}`);
    });
    return labels;
}

function bracketTeamRow(lado, pontos, winnerId, mostrarPlacar) {
    const classes = ["b-team"];
    if (!lado.definido) {
        classes.push("b-team--indefinido");
    }
    if (winnerId && lado.timeId === winnerId) {
        classes.push("b-team--vencedor");
    }
    if (lado.seed === 1) {
        classes.push("b-team--lider");
    }
    const seed = lado.seed ? `<span class="b-seed">${lado.seed}º</span>` : '<span class="b-seed b-seed--vazio"></span>';
    const placar = mostrarPlacar ? pontos : "–";
    return `
        <div class="${classes.join(" ")}">
            ${seed}
            <span class="b-nome">${lado.nome}</span>
            <span class="b-placar">${placar}</span>
        </div>
    `;
}

function renderBracketMatchup(jogo, teamById, jogoById, labelByJogoId) {
    const l1 = resolveLado(jogo, 1, teamById, jogoById, labelByJogoId);
    const l2 = resolveLado(jogo, 2, teamById, jogoById, labelByJogoId);
    if (!l1 || !l2) {
        return "";
    }

    const winnerId = getWinnerId(jogo);
    const titulo = labelByJogoId.get(jogo.id) || jogo.fase || "";
    const status = jogo.finalizado ? "FIM" : jogo.horario;
    const statusClass = jogo.finalizado ? "b-status b-status--fim" : "b-status";

    return `
        <a class="bracket-matchup" href="jogostats.html?jogoId=${encodeURIComponent(jogo.id)}">
            <div class="b-head">
                <span class="b-fase">${titulo}</span>
                <span class="${statusClass}">${status}</span>
            </div>
            ${bracketTeamRow(l1, jogo.placar.time1, winnerId, jogo.finalizado)}
            ${bracketTeamRow(l2, jogo.placar.time2, winnerId, jogo.finalizado)}
        </a>
    `;
}

/** Agrupa os jogos do grupo em colunas, uma por fase, na ordem em que acontecem. */
function agruparPorFase(jogos) {
    const colunas = [];
    jogos.forEach((jogo) => {
        const fase = jogo.fase || "Jogos";
        let coluna = colunas.find((c) => c.fase === fase);
        if (!coluna) {
            coluna = { fase, jogos: [] };
            colunas.push(coluna);
        }
        coluna.jogos.push(jogo);
    });
    return colunas;
}

function renderBracketGrupo(grupo, jogosDoGrupo, teamById, jogoById, labelByJogoId) {
    const colunas = agruparPorFase(jogosDoGrupo);

    const colunasHtml = colunas
        .map((coluna, idx) => {
            const proxima = colunas[idx + 1];
            // Duas chaves desembocando em uma só pedem a conexão em forma de garfo.
            // A última fase ainda liga na coluna do campeão, então nunca fica sem saída.
            const conector = proxima && coluna.jogos.length > proxima.jogos.length
                ? "bracket-round--junta"
                : "bracket-round--reta";

            const slots = coluna.jogos
                .map((jogo) => `<div class="bracket-slot">${renderBracketMatchup(jogo, teamById, jogoById, labelByJogoId)}</div>`)
                .join("");

            return `
                <div class="bracket-round ${conector}">
                    <div class="bracket-slots">${slots}</div>
                </div>
            `;
        })
        .join("");

    const final = jogosDoGrupo[jogosDoGrupo.length - 1];
    const campeaoId = final ? getWinnerId(final) : null;
    const campeao = campeaoId ? (teamById.get(campeaoId) || {}).nome || campeaoId : "A definir";
    const campeaoHtml = `
        <div class="bracket-round bracket-round--campeao">
            <div class="bracket-slots">
                <div class="bracket-slot">
                    <div class="bracket-champion ${campeaoId ? "" : "bracket-champion--vazio"}">
                        <span class="b-trofeu">🏆</span>
                        <span class="b-nome">${campeao}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    return `
        <h3 class="playoff-stage-title">Grupo ${grupo}</h3>
        <div class="tournament-bracket">
            ${colunasHtml}
            ${campeaoHtml}
        </div>
    `;
}

function renderJogosPlayoff(rodadaJogos, teamById, jogoById, labelByJogoId) {
    const grupos = [...new Set(rodadaJogos.map((j) => j.grupo).filter((g) => g !== undefined))].sort();
    if (grupos.length === 0) {
        return rodadaJogos.map((jogo) => createMatchCard(jogo, teamById, jogoById, labelByJogoId)).join("");
    }

    return grupos
        .map((grupo) => renderBracketGrupo(
            grupo,
            rodadaJogos.filter((j) => j.grupo === grupo),
            teamById,
            jogoById,
            labelByJogoId
        ))
        .join("");
}

function showRound(roundId, el) {
    document.querySelectorAll(".round-section").forEach((section) => section.classList.remove("active"));
    document.querySelectorAll(".round-tab").forEach((tab) => tab.classList.remove("active"));
    const current = document.getElementById(`round${roundId}`);
    if (current) {
        current.classList.add("active");
    }
    if (el) {
        el.classList.add("active");
    }
}

window.showRound = showRound;

async function initIndexPage() {
    const { times, rodadas, jogos } = await loadCampeonatoData();
    const teamById = toMap(times, "id");
    const jogoById = toMap(jogos, "id");
    const roundsContainer = document.getElementById("roundsContainer");
    const roundTabs = document.getElementById("roundTabs");

    const sortedRodadas = [...rodadas].sort((a, b) => a.id - b.id);
    const firstOpenRound = sortedRodadas.find((r) => {
        const rodadaJogos = (Array.isArray(r.jogosIds) ? r.jogosIds : [])
            .map((id) => jogoById.get(id))
            .filter(Boolean);
        return rodadaJogos.some((j) => !j.finalizado);
    });
    const activeRoundId = firstOpenRound ? firstOpenRound.id : (sortedRodadas[0] ? sortedRodadas[0].id : 1);

    roundTabs.innerHTML = sortedRodadas
        .map((rodada) => `
            <button class="round-tab ${rodada.id === activeRoundId ? "active" : ""}" onclick="showRound(${rodada.id}, this)">
                ${rodada.playoffs ? '🏆PLAYOFFS🏆' : `Rodada ${rodada.id}`}
            </button>
        `)
        .join("");

    roundsContainer.innerHTML = sortedRodadas
        .map((rodada) => {
            const rodadaJogos = (Array.isArray(rodada.jogosIds) ? rodada.jogosIds : [])
                .map((id) => jogoById.get(id))
                .filter(Boolean)
                .sort((a, b) => a.horario.localeCompare(b.horario));

            const labelByJogoId = buildLabelByJogoId(rodadaJogos);
            const corpo = rodada.playoffs
                ? renderJogosPlayoff(rodadaJogos, teamById, jogoById, labelByJogoId)
                : rodadaJogos.map((jogo) => createMatchCard(jogo, teamById, jogoById, labelByJogoId)).join("");

            return `
                <div id="round${rodada.id}" class="round-section ${rodada.id === activeRoundId ? "active" : ""}">
                    <div class="round-header">
                        <h2>${rodada.playoffs ? '🏆PLAYOFFS🏆' : `Rodada ${rodada.id}`}</h2>
                        <div class="date">${formatDateBR(rodada.data)}</div>
                    </div>
                    <div class="schedule-wrapper">
                        ${corpo}
                    </div>
                    <div class="footer">Temporada 2026 • Liga Will Sports</div>
                </div>
            `;
        })
        .join("");
}

initIndexPage().catch((error) => {
    console.error(error);
    const roundsContainer = document.getElementById("roundsContainer");
    roundsContainer.innerHTML = '<div class="round-section active"><div class="footer">Erro ao carregar dados. Verifique os arquivos JSON em /data.</div></div>';
});
