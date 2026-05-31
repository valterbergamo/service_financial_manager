const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {

    const {
        GruposContas, Contas, Planejamentos, Lancamentos, RevisoesPlanejamento,
        PlanosOrcamento, PlanejamentosSnapshot,
    } = this.entities;

    /**
     * Após criar um lançamento com recorrencias > 1, soma o valor da parcela
     * nos planejamentos dos próximos meses (mês atual + N-1 parcelas futuras).
     * O mês atual já entra como despesa real via o próprio lançamento.
     */
    this.after('CREATE', Lancamentos, async (lanc, req) => {
        const recorrencias = Number(lanc?.recorrencias || 1);
        if (recorrencias <= 1 || !lanc?.data || !lanc?.conta_ID) return;

        const valor = Number(lanc.valor) || 0;
        if (valor === 0) return;

        // Data do lançamento define a primeira parcela; cria nos próximos N-1 meses
        const [yStr, mStr] = String(lanc.data).split('-');
        let ano = parseInt(yStr, 10);
        let mes = parseInt(mStr, 10);
        const descricaoBase = lanc.descricao
            ? `${lanc.descricao} (recorrência)`
            : 'Recorrência';

        for (let i = 1; i < recorrencias; i++) {
            mes++;
            if (mes > 12) { mes = 1; ano++; }

            const existente = await SELECT.one.from(Planejamentos)
                .where({ conta_ID: lanc.conta_ID, ano, mes });
            const novoValor = (existente ? Number(existente.valorPlanejado) : 0) + valor;

            await aplicarUpsert(this, {
                contaId: lanc.conta_ID,
                ano, mes,
                valor: novoValor,
                motivo: `${descricaoBase} ${i + 1}/${recorrencias}`,
                manual: true, // não é fórmula, é compromisso futuro real
            });
        }
    });

    /**
     * Comparativo planejado x realizado por conta no mês.
     */
    this.on('comparativoMensal', async (req) => {
        const { ano, mes } = req.data;
        if (!ano || !mes) return [];

        const planos = await SELECT.from(Planejamentos).where({ ano, mes });

        const contas = await SELECT.from(Contas)
            .columns('ID', 'nome', 'grupo_ID');
        const grupos = await SELECT.from(GruposContas)
            .columns('ID', 'nome', 'tipo', 'cor');

        const contaMap = new Map(contas.map(c => [c.ID, c]));
        const grupoMap = new Map(grupos.map(g => [g.ID, g]));

        const dataIni = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const dataFim = mes === 12
            ? `${ano + 1}-01-01`
            : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;

        const lancs = await SELECT.from(Lancamentos)
            .columns('conta_ID', 'valor')
            .where`data >= ${dataIni} and data < ${dataFim}`;

        const realizadoPorConta = new Map();
        for (const l of lancs) {
            const atual = realizadoPorConta.get(l.conta_ID) || 0;
            realizadoPorConta.set(l.conta_ID, atual + Number(l.valor));
        }

        const contasComMov = new Set([
            ...planos.map(p => p.conta_ID),
            ...lancs.map(l => l.conta_ID),
        ]);

        const linhas = [];
        for (const contaId of contasComMov) {
            const conta = contaMap.get(contaId);
            if (!conta) continue;
            const grupo = grupoMap.get(conta.grupo_ID) || {};
            const plano = planos.find(p => p.conta_ID === contaId);
            const planejado = plano ? Number(plano.valorPlanejado) : 0;
            const realizado = realizadoPorConta.get(contaId) || 0;
            const diferenca = realizado - planejado;
            const percentual = planejado === 0
                ? (realizado === 0 ? 0 : 100)
                : Math.round((realizado / planejado) * 10000) / 100;
            linhas.push({
                conta_ID: contaId,
                nomeConta: conta.nome,
                grupo_ID: conta.grupo_ID,
                nomeGrupo: grupo.nome || '',
                tipo: grupo.tipo || '',
                cor: grupo.cor || '',
                ano, mes,
                planejado, realizado, diferenca, percentual,
            });
        }

        linhas.sort((a, b) => {
            if (a.tipo !== b.tipo) return a.tipo === 'RECEITA' ? -1 : 1;
            if (a.nomeGrupo !== b.nomeGrupo) return a.nomeGrupo.localeCompare(b.nomeGrupo);
            return a.nomeConta.localeCompare(b.nomeConta);
        });
        return linhas;
    });

    /**
     * Resumo do mês com totais agregados.
     * Consulta direta a Planejamentos + Lancamentos (não passa por outro handler).
     */
    this.on('resumoMensal', async (req) => {
        const { ano, mes } = req.data;
        const zero = {
            ano, mes,
            receitaPlanejada: 0, receitaRealizada: 0,
            despesaPlanejada: 0, despesaRealizada: 0,
            reservaPlanejada: 0, reservaRealizada: 0,
            saldoPlanejado: 0, saldoRealizado: 0,
            reservaAcumulada: 0,
        };
        if (!ano || !mes) return zero;

        const [planos, contas, grupos] = await Promise.all([
            SELECT.from(Planejamentos).where({ ano, mes }),
            SELECT.from(Contas).columns('ID', 'grupo_ID'),
            SELECT.from(GruposContas).columns('ID', 'tipo'),
        ]);

        const grupoTipo = new Map(grupos.map(g => [g.ID, g.tipo]));
        const contaTipo = new Map();
        for (const c of contas) contaTipo.set(c.ID, grupoTipo.get(c.grupo_ID));

        let receitaPlanejada = 0, despesaPlanejada = 0, reservaPlanejada = 0;
        for (const p of planos) {
            const tipo = contaTipo.get(p.conta_ID);
            const v = Number(p.valorPlanejado) || 0;
            if (tipo === 'RECEITA') receitaPlanejada += v;
            else if (tipo === 'RESERVA') reservaPlanejada += v;
            else if (tipo === 'DESPESA') despesaPlanejada += v;
        }

        const dataIni = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const dataFim = mes === 12
            ? `${ano + 1}-01-01`
            : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
        const lancs = await SELECT.from(Lancamentos)
            .columns('conta_ID', 'valor')
            .where`data >= ${dataIni} and data < ${dataFim}`;

        let receitaRealizada = 0, despesaRealizada = 0, reservaRealizada = 0;
        for (const l of lancs) {
            const tipo = contaTipo.get(l.conta_ID);
            const v = Number(l.valor) || 0;
            if (tipo === 'RECEITA') receitaRealizada += v;
            else if (tipo === 'RESERVA') reservaRealizada += v;
            else if (tipo === 'DESPESA') despesaRealizada += v;
        }

        // Saldos acumulados (conta corrente e poupança) até o fim do mês.
        const { contaCorrente, poupanca } = await calcularSaldosAcumulados(this, ano, mes, contaTipo);

        // Saldo livre da conta = receita − despesa − reserva.
        // A reserva é uma saída da conta corrente para a poupança: não é gasto,
        // mas reduz o dinheiro livre disponível (acumula em reservaAcumulada).
        return {
            ano, mes,
            receitaPlanejada,
            receitaRealizada,
            despesaPlanejada,
            despesaRealizada,
            reservaPlanejada,
            reservaRealizada,
            saldoPlanejado: receitaPlanejada - despesaPlanejada - reservaPlanejada,
            saldoRealizado: receitaRealizada - despesaRealizada - reservaRealizada,
            reservaAcumulada: poupanca,
            saldoContaCorrente: contaCorrente,
        };
    });

    /**
     * Composição acumulada da poupança por conta de reserva (aportes do ano
     * até o mês informado). Permite "abrir a poupança" e ver o que tem em cada
     * reserva (emergência, viagem, etc.).
     */
    this.on('composicaoReservas', async (req) => {
        const { ano, mes } = req.data;
        if (!ano || !mes) return [];

        const [contas, grupos] = await Promise.all([
            SELECT.from(Contas).columns('ID', 'nome', 'grupo_ID'),
            SELECT.from(GruposContas).columns('ID', 'tipo', 'cor'),
        ]);
        const grupoMap = new Map(grupos.map(g => [g.ID, g]));
        const contaInfo = new Map(contas.map(c => [c.ID, c]));

        const dataIniAno = `${ano}-01-01`;
        const dataFim = mes === 12
            ? `${ano + 1}-01-01`
            : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
        const lancs = await SELECT.from(Lancamentos)
            .columns('conta_ID', 'valor')
            .where`data >= ${dataIniAno} and data < ${dataFim}`;

        const porConta = new Map();
        for (const l of lancs) {
            const c = contaInfo.get(l.conta_ID);
            const g = c ? grupoMap.get(c.grupo_ID) : null;
            if (!g || g.tipo !== 'RESERVA') continue;
            porConta.set(l.conta_ID, (porConta.get(l.conta_ID) || 0) + (Number(l.valor) || 0));
        }

        const linhas = [];
        for (const [contaId, valor] of porConta) {
            const c = contaInfo.get(contaId);
            const g = grupoMap.get(c.grupo_ID) || {};
            linhas.push({ conta_ID: contaId, nome: c.nome, cor: g.cor || '#0d9488', valor });
        }
        linhas.sort((a, b) => b.valor - a.valor);
        return linhas;
    });

    /**
     * Conferência de saldo: compara o saldo calculado (conta corrente ou
     * poupança) com o valor real informado e, havendo divergência, lança um
     * ajuste para igualar. Conta corrente → despesa/receita de ajuste;
     * poupança → aporte/resgate de ajuste (reserva).
     */
    this.on('lancarAjusteSaldo', async (req) => {
        const { ano, mes, alvo, valorReal, data } = req.data;
        if (!ano || !mes || !alvo) {
            req.error(400, 'ano, mes e alvo são obrigatórios.');
            return;
        }
        if (alvo !== 'CONTA' && alvo !== 'POUPANCA') {
            req.error(400, "alvo deve ser 'CONTA' ou 'POUPANCA'.");
            return;
        }

        // Conferência é sobre o saldo DO MÊS (igual ao card do dashboard).
        const mesVals = await calcularSaldoMes(this, ano, mes);
        const atual = alvo === 'POUPANCA' ? mesVals.reserva : mesVals.saldo;
        const diff = Math.round((Number(valorReal) - atual) * 100) / 100;

        if (Math.abs(diff) < 0.005) {
            return { ajustado: false, diferenca: 0, saldoAtual: atual, message: 'Sem divergência — nenhum ajuste necessário.' };
        }

        let tipo, valor, descricao;
        if (alvo === 'POUPANCA') {
            tipo = 'RESERVA';
            valor = diff; // positivo = aporte; negativo = resgate
            descricao = diff > 0 ? 'Ajuste de poupança (aporte)' : 'Ajuste de poupança (resgate)';
        } else if (diff < 0) {
            tipo = 'DESPESA';
            valor = -diff;
            descricao = 'Ajuste de saldo (saída)';
        } else {
            tipo = 'RECEITA';
            valor = diff;
            descricao = 'Ajuste de saldo (entrada)';
        }

        const contaId = await ensureContaAjuste(this, tipo);

        // Data do ajuste: hoje se conferindo o mês corrente, senão último dia do mês.
        let dataLanc = data;
        if (!dataLanc) {
            const hoje = new Date();
            const ultimoDia = new Date(ano, mes, 0).getDate();
            const dia = (hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes)
                ? hoje.getDate() : ultimoDia;
            dataLanc = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        }

        await INSERT.into(Lancamentos).entries({
            conta_ID: contaId, data: dataLanc, descricao,
            valor, pago: true, recorrencias: 1,
        });

        return { ajustado: true, diferenca: diff, saldoAtual: atual, novoSaldo: Number(valorReal), message: descricao };
    });

    /**
     * Define/acerta o saldo inicial (abertura do ano) para que o saldo
     * acumulado calculado passe a bater com o valor real informado — sem criar
     * lançamento. Ideal para configurar o saldo real da conta/poupança a 1ª vez.
     */
    this.on('ajustarSaldoInicial', async (req) => {
        const { ano, mes, alvo, valorReal } = req.data;
        if (!ano || !mes || !alvo) {
            req.error(400, 'ano, mes e alvo são obrigatórios.');
            return;
        }
        if (alvo !== 'CONTA' && alvo !== 'POUPANCA') {
            req.error(400, "alvo deve ser 'CONTA' ou 'POUPANCA'.");
            return;
        }

        const saldos = await calcularSaldosAcumulados(this, ano, mes);
        const atual = alvo === 'POUPANCA' ? saldos.poupanca : saldos.contaCorrente;
        const diff = Math.round((Number(valorReal) - atual) * 100) / 100;

        if (Math.abs(diff) < 0.005) {
            return { ajustado: false, diferenca: 0, saldoAtual: atual, message: 'Sem divergência — nenhum ajuste necessário.' };
        }

        const plano = await garantirPlanoDoAno(this, ano);
        const antRec = Number(plano.saldoAnteriorReceitas) || 0;
        const antRes = Number(plano.saldoAnteriorReservas) || 0;

        // CONTA: aumenta a abertura de receitas (conta += diff).
        // POUPANCA: aumenta abertura de reservas (poupança += diff) e também a de
        // receitas (para a conta corrente NÃO mudar — dinheiro já estava guardado).
        const patch = {};
        if (alvo === 'POUPANCA') {
            patch.saldoAnteriorReservas = antRes + diff;
            patch.saldoAnteriorReceitas = antRec + diff;
        } else {
            patch.saldoAnteriorReceitas = antRec + diff;
        }
        await UPDATE(PlanosOrcamento).set(patch).where({ ID: plano.ID });

        return { ajustado: true, diferenca: diff, saldoAtual: atual, novoSaldo: Number(valorReal), message: 'Saldo inicial ajustado.' };
    });

    /**
     * Grade anual: para cada conta ativa, retorna 12 valores (jan..dez)
     * e a contagem de revisões em cada mês.
     */
    this.on('planejamentoAnual', async (req) => {
        const { ano } = req.data;
        if (!ano) return [];

        const grupos = await SELECT.from(GruposContas)
            .where({ ativo: true });
        const contas = await SELECT.from(Contas)
            .where({ ativo: true });
        const planos = await SELECT.from(Planejamentos)
            .where({ ano });
        const revs = await SELECT.from(RevisoesPlanejamento)
            .columns('conta_ID', 'mes')
            .where({ ano });

        const grupoMap = new Map(grupos.map(g => [g.ID, g]));

        const planosMap = new Map(); // conta_ID -> [12]
        const manualMap = new Map(); // conta_ID -> [12]
        for (const p of planos) {
            if (!planosMap.has(p.conta_ID)) {
                planosMap.set(p.conta_ID, new Array(12).fill(0));
                manualMap.set(p.conta_ID, new Array(12).fill(false));
            }
            planosMap.get(p.conta_ID)[p.mes - 1] = Number(p.valorPlanejado);
            manualMap.get(p.conta_ID)[p.mes - 1] = !!p.manual;
        }

        const revsMap = new Map(); // conta_ID -> [12]
        for (const r of revs) {
            if (!revsMap.has(r.conta_ID)) {
                revsMap.set(r.conta_ID, new Array(12).fill(0));
            }
            revsMap.get(r.conta_ID)[r.mes - 1]++;
        }

        const linhas = contas.map(c => {
            const grupo = grupoMap.get(c.grupo_ID) || {};
            const valores = planosMap.get(c.ID) || new Array(12).fill(0);
            const manualPorMes = manualMap.get(c.ID) || new Array(12).fill(false);
            const revisoesPorMes = revsMap.get(c.ID) || new Array(12).fill(0);
            const total = valores.reduce((s, v) => s + Number(v), 0);
            return {
                conta_ID: c.ID,
                nomeConta: c.nome,
                grupo_ID: c.grupo_ID,
                nomeGrupo: grupo.nome || '',
                tipo: grupo.tipo || '',
                cor: grupo.cor || '',
                formula: c.formula || '',
                valores,
                manualPorMes,
                revisoesPorMes,
                total,
            };
        });

        linhas.sort((a, b) => {
            if (a.tipo !== b.tipo) return a.tipo === 'RECEITA' ? -1 : 1;
            if (a.nomeGrupo !== b.nomeGrupo) return a.nomeGrupo.localeCompare(b.nomeGrupo);
            return a.nomeConta.localeCompare(b.nomeConta);
        });
        return linhas;
    });

    /**
     * Upsert do planejamento mensal. Registra revisão sempre que o valor mudar
     * (inclusive na primeira inserção, com valorAnterior = null).
     */
    this.on('upsertPlanejamento', async (req) => {
        const { conta, ano, mes, valor, observacao, motivo } = req.data;
        if (!conta || !ano || !mes) {
            req.error(400, 'Conta, ano e mês são obrigatórios.');
            return;
        }
        const valorNum = Number(valor) || 0;

        const result = await aplicarUpsert(this, {
            contaId: conta, ano, mes, valor: valorNum, observacao, motivo,
            usuario: req.user?.id,
        });
        // Recalcula fórmulas do mês para refletir o novo valor
        await recalcularMes(this, ano, mes, 'Recálculo automático após edição');
        return result;
    });

    /**
     * Upsert em lote estilo planilha: atualiza várias células de uma vez.
     * Após aplicar as edições, dispara recálculo das fórmulas dos meses afetados.
     */
    this.on('upsertPlanejamentoAnual', async (req) => {
        const { ano, celulas, motivo } = req.data;
        if (!ano || !Array.isArray(celulas)) {
            req.error(400, 'ano e celulas são obrigatórios.');
            return 0;
        }

        let alterados = 0;
        const mesesAfetados = new Set();
        for (const c of celulas) {
            if (!c.conta_ID || !c.mes) continue;
            const r = await aplicarUpsert(this, {
                contaId: c.conta_ID,
                ano,
                mes: c.mes,
                valor: Number(c.valor) || 0,
                motivo,
                usuario: req.user?.id,
            });
            if (r?.__changed) alterados++;
            mesesAfetados.add(c.mes);
        }

        // Recalcula fórmulas para os meses que foram alterados
        for (const mes of mesesAfetados) {
            await recalcularMes(this, ano, mes, 'Recálculo automático após edição');
        }

        return alterados;
    });

    /**
     * Recalcula fórmulas de todas as contas para um mês.
     */
    this.on('recalcularPlanejamento', async (req) => {
        const { ano, mes } = req.data;
        if (!ano || !mes) { req.error(400, 'ano e mes obrigatórios'); return 0; }
        return await recalcularMes(this, ano, mes, 'Recálculo manual');
    });

    /**
     * Recalcula fórmulas para os 12 meses do ano.
     */
    this.on('recalcularPlanejamentoAnual', async (req) => {
        const { ano } = req.data;
        if (!ano) { req.error(400, 'ano obrigatório'); return 0; }
        let total = 0;
        for (let m = 1; m <= 12; m++) {
            total += await recalcularMes(this, ano, m, 'Recálculo anual manual');
        }
        return total;
    });

    /**
     * Garante que existe um plano de orçamento pro ano.
     */
    this.on('garantirPlano', async (req) => {
        return await garantirPlanoDoAno(this, req.data.ano);
    });

    /**
     * Renomeia o plano.
     */
    this.on('renomearPlano', async (req) => {
        const { ano, nome, descricao } = req.data;
        const plano = await garantirPlanoDoAno(this, ano);
        const patch = {};
        if (nome != null) patch.nome = nome;
        if (descricao != null) patch.descricao = descricao;
        if (Object.keys(patch).length > 0) {
            await UPDATE(PlanosOrcamento).set(patch).where({ ID: plano.ID });
        }
        return await SELECT.one.from(PlanosOrcamento).where({ ID: plano.ID });
    });

    /**
     * Edita o plano (todos os campos editáveis).
     */
    this.on('editarPlano', async (req) => {
        const {
            ano, nome, descricao,
            saldoAnteriorReceitas,
            saldoAnteriorDespesas,
            saldoAnteriorReservas,
        } = req.data;
        const plano = await garantirPlanoDoAno(this, ano);
        const patch = {};
        if (nome != null) patch.nome = nome;
        if (descricao != null) patch.descricao = descricao;
        if (saldoAnteriorReceitas != null) patch.saldoAnteriorReceitas = saldoAnteriorReceitas;
        if (saldoAnteriorDespesas != null) patch.saldoAnteriorDespesas = saldoAnteriorDespesas;
        if (saldoAnteriorReservas != null) patch.saldoAnteriorReservas = saldoAnteriorReservas;
        if (Object.keys(patch).length > 0) {
            await UPDATE(PlanosOrcamento).set(patch).where({ ID: plano.ID });
        }
        return await SELECT.one.from(PlanosOrcamento).where({ ID: plano.ID });
    });

    /**
     * Publica o plano. Salva um snapshot dos valores atuais para
     * permitir comparações futuras (publicado x revisado).
     */
    this.on('publicarPlano', async (req) => {
        const { PlanejamentosSnapshot } = this.entities;
        const ano = req.data.ano;
        const plano = await garantirPlanoDoAno(this, ano);

        // Limpa snapshot anterior do plano e refaz com valores atuais
        await DELETE.from(PlanejamentosSnapshot).where({ plano_ID: plano.ID });
        const planosAtuais = await SELECT.from(Planejamentos).where({ ano });
        if (planosAtuais.length > 0) {
            const entries = planosAtuais.map(p => ({
                plano_ID: plano.ID,
                conta_ID: p.conta_ID,
                ano: p.ano,
                mes: p.mes,
                valorPublicado: p.valorPlanejado,
            }));
            await INSERT.into(PlanejamentosSnapshot).entries(entries);
        }

        await UPDATE(PlanosOrcamento)
            .set({ status: 'PUBLICADO', publicadoEm: new Date().toISOString() })
            .where({ ID: plano.ID });
        return await SELECT.one.from(PlanosOrcamento).where({ ID: plano.ID });
    });

    /**
     * Volta para rascunho.
     */
    this.on('voltarRascunho', async (req) => {
        const plano = await garantirPlanoDoAno(this, req.data.ano);
        await UPDATE(PlanosOrcamento)
            .set({ status: 'RASCUNHO' })
            .where({ ID: plano.ID });
        return await SELECT.one.from(PlanosOrcamento).where({ ID: plano.ID });
    });

    /**
     * Limpa todos os planejamentos do ano (só em rascunho).
     */
    this.on('limparPlano', async (req) => {
        const { ano } = req.data;
        if (!ano) { req.error(400, 'ano obrigatório'); return 0; }

        const plano = await garantirPlanoDoAno(this, ano);
        if (plano.status === 'PUBLICADO') {
            req.error(400, 'Plano publicado não pode ser limpo. Volte para rascunho primeiro.');
            return 0;
        }

        // Apaga revisões e planejamentos do ano
        await DELETE.from(RevisoesPlanejamento).where({ ano });
        const apagados = await DELETE.from(Planejamentos).where({ ano });
        return apagados || 0;
    });

    /**
     * Valida sintaxe da fórmula.
     */
    this.on('validarFormula', (req) => {
        const { formula } = req.data;
        if (!formula || !formula.trim()) return '';
        try {
            // Dry-run: avalia com contexto vazio para checar sintaxe
            avaliarFormula(formula, {
                receitaTotal: 0, despesaTotal: 0,
                grupos: new Map(), contas: new Map(),
            });
            return '';
        } catch (e) {
            return e.message || 'Fórmula inválida';
        }
    });

});

// ===================================================================
// Avaliador de fórmulas
// ===================================================================

/**
 * Avalia uma fórmula textual com tokens semânticos.
 *
 * Tokens:
 *   %RECEITA          → ctx.receitaTotal
 *   %DESPESA          → ctx.despesaTotal
 *   %GRUPO[Nome]      → ctx.grupos.get(Nome)
 *   %CONTA[Nome]      → ctx.contas.get(Nome)
 *
 * Operadores: + - * / ( )   |   percentuais: 10%   |   números com . ou ,
 */
function avaliarFormula(formulaRaw, ctx) {
    if (!formulaRaw) return 0;
    let expr = String(formulaRaw);

    // Tokens
    expr = expr.replace(/%RECEITA\b/gi, () => num(ctx.receitaTotal));
    expr = expr.replace(/%DESPESA\b/gi, () => num(ctx.despesaTotal));
    expr = expr.replace(/%GRUPO\s*\[([^\]]+)\]/gi,
        (_, n) => num(ctx.grupos.get(String(n).trim())));
    expr = expr.replace(/%CONTA\s*\[([^\]]+)\]/gi,
        (_, n) => num(ctx.contas.get(String(n).trim())));

    // Tokens não resolvidos: erro
    if (/%[A-Za-z]/.test(expr)) {
        throw new Error('Token desconhecido na fórmula');
    }

    // Vírgula decimal -> ponto
    expr = expr.replace(/(\d+),(\d+)/g, '$1.$2');

    // Percentuais: "10%" -> "(10/100)"
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*%/g, (_, n) => `(${n}/100)`);

    // Whitelist: só dígitos, ponto, operadores e parênteses
    if (!/^[\d\s+\-*/().eE]*$/.test(expr)) {
        throw new Error('Caracteres inválidos na fórmula');
    }
    if (!expr.trim()) return 0;

    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('"use strict"; return (' + expr + ')');
        const r = fn();
        if (!Number.isFinite(r)) return 0;
        return Math.round(r * 100) / 100;
    } catch {
        throw new Error('Erro ao avaliar a fórmula');
    }
}

function num(v) {
    const n = Number(v) || 0;
    return n < 0 ? `(${n})` : String(n);
}

/**
 * Recalcula valor planejado de todas as contas com fórmula em um mês.
 * Usa iteração até estabilidade (máx 10 iterações) para resolver dependências.
 */
async function recalcularMes(srv, ano, mes, motivo) {
    const { GruposContas, Contas, Planejamentos } = srv.entities;

    const grupos = await SELECT.from(GruposContas).where({ ativo: true });
    const contas = await SELECT.from(Contas).where({ ativo: true });
    const planos = await SELECT.from(Planejamentos).where({ ano, mes });

    const grupoMap = new Map(grupos.map(g => [g.ID, g]));
    const valorMap = new Map();
    const manualMap = new Map();
    for (const p of planos) {
        valorMap.set(p.conta_ID, Number(p.valorPlanejado));
        manualMap.set(p.conta_ID, !!p.manual);
    }
    for (const c of contas) {
        if (!valorMap.has(c.ID)) valorMap.set(c.ID, 0);
    }

    // Apenas contas com fórmula E SEM override manual no mês são recalculadas
    const formulasContas = contas.filter(
        c => c.formula && c.formula.trim() && !manualMap.get(c.ID),
    );
    if (formulasContas.length === 0) return 0;

    // Iteração até estabilidade
    let mudou = true;
    let iter = 0;
    while (mudou && iter < 10) {
        mudou = false; iter++;

        const totaisTipo = { RECEITA: 0, DESPESA: 0, RESERVA: 0 };
        const totaisGrupo = new Map();
        for (const c of contas) {
            const v = valorMap.get(c.ID) || 0;
            const g = grupoMap.get(c.grupo_ID);
            if (!g) continue;
            totaisTipo[g.tipo] = (totaisTipo[g.tipo] || 0) + v;
            totaisGrupo.set(g.nome, (totaisGrupo.get(g.nome) || 0) + v);
        }
        const ctx = {
            receitaTotal: totaisTipo.RECEITA,
            despesaTotal: totaisTipo.DESPESA,
            reservaTotal: totaisTipo.RESERVA,
            grupos: totaisGrupo,
            contas: new Map(contas.map(c => [c.nome, valorMap.get(c.ID) || 0])),
        };

        for (const c of formulasContas) {
            let novo = 0;
            try { novo = avaliarFormula(c.formula, ctx); }
            catch { novo = 0; }
            const atual = valorMap.get(c.ID) || 0;
            if (Math.abs(novo - atual) > 0.005) {
                valorMap.set(c.ID, novo);
                mudou = true;
            }
        }
    }

    // Persiste cada conta de fórmula como NÃO-manual
    let alterados = 0;
    for (const c of formulasContas) {
        const novo = valorMap.get(c.ID) || 0;
        const r = await aplicarUpsert(srv, {
            contaId: c.ID, ano, mes, valor: novo, motivo,
            manual: false, // recálculo automático, não é override do usuário
        });
        if (r?.__changed) alterados++;
    }
    return alterados;
}

/**
 * Garante que existe um PlanoOrcamento pro ano (cria como RASCUNHO se não houver).
 */
async function garantirPlanoDoAno(srv, ano) {
    const { PlanosOrcamento } = srv.entities;
    let plano = await SELECT.one.from(PlanosOrcamento).where({ ano });
    if (!plano) {
        await INSERT.into(PlanosOrcamento).entries({
            ano,
            nome: `Orçamento ${ano}`,
            status: 'RASCUNHO',
        });
        plano = await SELECT.one.from(PlanosOrcamento).where({ ano });
    }
    return plano;
}

/**
 * Calcula os saldos reais acumulados até o fim do mês informado:
 *  - contaCorrente = (saldoAnterior receitas − despesas − reservas)
 *                    + Σ(receita − despesa − reserva) realizadas no ano até o mês
 *  - poupanca      = saldoAnteriorReservas + Σ(reserva) realizadas no ano até o mês
 *
 * `contaTipoOpt` (Map conta_ID → tipo) pode ser passado para evitar reconsulta.
 */
async function calcularSaldosAcumulados(srv, ano, mes, contaTipoOpt) {
    const { Contas, GruposContas, Lancamentos, PlanosOrcamento } = srv.entities;

    let contaTipo = contaTipoOpt;
    if (!contaTipo) {
        const [contas, grupos] = await Promise.all([
            SELECT.from(Contas).columns('ID', 'grupo_ID'),
            SELECT.from(GruposContas).columns('ID', 'tipo'),
        ]);
        const grupoTipo = new Map(grupos.map(g => [g.ID, g.tipo]));
        contaTipo = new Map(contas.map(c => [c.ID, grupoTipo.get(c.grupo_ID)]));
    }

    const dataIniAno = `${ano}-01-01`;
    const dataFim = mes === 12
        ? `${ano + 1}-01-01`
        : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;

    const [plano, lancs] = await Promise.all([
        SELECT.one.from(PlanosOrcamento)
            .columns('saldoAnteriorReceitas', 'saldoAnteriorDespesas', 'saldoAnteriorReservas')
            .where({ ano }),
        SELECT.from(Lancamentos).columns('conta_ID', 'valor')
            .where`data >= ${dataIniAno} and data < ${dataFim}`,
    ]);

    let r = 0, d = 0, res = 0;
    for (const l of lancs) {
        const t = contaTipo.get(l.conta_ID);
        const v = Number(l.valor) || 0;
        if (t === 'RECEITA') r += v;
        else if (t === 'RESERVA') res += v;
        else if (t === 'DESPESA') d += v;
    }

    const antRec = Number(plano?.saldoAnteriorReceitas) || 0;
    const antDesp = Number(plano?.saldoAnteriorDespesas) || 0;
    const antRes = Number(plano?.saldoAnteriorReservas) || 0;

    const contaCorrente = Math.round(((antRec - antDesp - antRes) + (r - d - res)) * 100) / 100;
    const poupanca = Math.round((antRes + res) * 100) / 100;
    return { contaCorrente, poupanca };
}

/**
 * Saldo realizado DO MÊS (não acumulado):
 *  - saldo   = Σ(receita) − Σ(despesa) − Σ(reserva) lançadas no mês
 *  - reserva = Σ(reserva) lançada no mês
 */
async function calcularSaldoMes(srv, ano, mes) {
    const { Contas, GruposContas, Lancamentos } = srv.entities;
    const [contas, grupos] = await Promise.all([
        SELECT.from(Contas).columns('ID', 'grupo_ID'),
        SELECT.from(GruposContas).columns('ID', 'tipo'),
    ]);
    const grupoTipo = new Map(grupos.map(g => [g.ID, g.tipo]));
    const contaTipo = new Map(contas.map(c => [c.ID, grupoTipo.get(c.grupo_ID)]));

    const dataIni = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const dataFim = mes === 12
        ? `${ano + 1}-01-01`
        : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
    const lancs = await SELECT.from(Lancamentos).columns('conta_ID', 'valor')
        .where`data >= ${dataIni} and data < ${dataFim}`;

    let r = 0, d = 0, res = 0;
    for (const l of lancs) {
        const t = contaTipo.get(l.conta_ID);
        const v = Number(l.valor) || 0;
        if (t === 'RECEITA') r += v;
        else if (t === 'RESERVA') res += v;
        else if (t === 'DESPESA') d += v;
    }
    return { saldo: Math.round((r - d - res) * 100) / 100, reserva: Math.round(res * 100) / 100 };
}

/**
 * Garante a existência de um grupo "Ajustes" + conta de ajuste para o tipo
 * informado (usado pela conferência de saldo). Retorna o ID da conta.
 */
async function ensureContaAjuste(srv, tipo) {
    const { GruposContas, Contas } = srv.entities;

    let grupo = await SELECT.one.from(GruposContas).where({ nome: 'Ajustes', tipo });
    if (!grupo) {
        await INSERT.into(GruposContas).entries({
            nome: 'Ajustes', tipo, cor: '#64748b', icone: '⚖', ativo: true,
            descricao: 'Lançamentos de ajuste gerados pela conferência de saldo.',
        });
        grupo = await SELECT.one.from(GruposContas).where({ nome: 'Ajustes', tipo });
    }

    const nomeConta = tipo === 'RESERVA' ? 'Ajuste de poupança'
        : tipo === 'DESPESA' ? 'Ajuste de saldo (saída)'
            : 'Ajuste de saldo (entrada)';

    let conta = await SELECT.one.from(Contas).where({ nome: nomeConta, grupo_ID: grupo.ID });
    if (!conta) {
        await INSERT.into(Contas).entries({
            nome: nomeConta, grupo_ID: grupo.ID, ativo: true,
            descricao: 'Gerada automaticamente pela conferência de saldo.',
        });
        conta = await SELECT.one.from(Contas).where({ nome: nomeConta, grupo_ID: grupo.ID });
    }
    return conta.ID;
}

/**
 * Lógica compartilhada de upsert. Só registra revisão se o plano do ano
 * estiver com status PUBLICADO. Em RASCUNHO as edições são livres.
 *
 * - `manual`: indica se é edição direta do usuário (true) ou recálculo
 *   automático de fórmula (false). Default true.
 */
async function aplicarUpsert(srv, { contaId, ano, mes, valor, observacao, motivo, usuario, manual = true }) {
    const { Planejamentos, RevisoesPlanejamento } = srv.entities;

    const planoOrc = await garantirPlanoDoAno(srv, ano);
    const isPublicado = planoOrc?.status === 'PUBLICADO';

    const existente = await SELECT.one.from(Planejamentos)
        .where({ conta_ID: contaId, ano, mes });

    const valorAnterior = existente ? Number(existente.valorPlanejado) : null;
    const valorMudou = !existente || Number(existente.valorPlanejado) !== valor;
    const mudou = valorMudou
        || (observacao !== undefined && observacao !== existente?.observacao);

    let planoId;
    if (existente) {
        const patch = { valorPlanejado: valor, manual };
        if (observacao !== undefined) patch.observacao = observacao;
        await UPDATE(Planejamentos).set(patch).where({ ID: existente.ID });
        planoId = existente.ID;
    } else {
        const insRes = await INSERT.into(Planejamentos).entries({
            conta_ID: contaId, ano, mes,
            valorPlanejado: valor,
            manual,
            observacao,
        });
        planoId = insRes?.results?.[0]?.ID
            || insRes?.[0]?.ID
            || (await SELECT.one.from(Planejamentos).where({ conta_ID: contaId, ano, mes })).ID;
    }

    // Só grava revisão se o plano estiver publicado
    if (isPublicado && valorMudou) {
        await INSERT.into(RevisoesPlanejamento).entries({
            planejamento_ID: planoId,
            conta_ID: contaId,
            ano, mes,
            valorAnterior,
            valorNovo: valor,
            motivo,
        });
    }

    const final = await SELECT.one.from(Planejamentos).where({ ID: planoId });
    return Object.assign({}, final, { __changed: mudou });
}
