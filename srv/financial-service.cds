using { br.com.financial as fin } from '../db/schema';

@path: '/financial'
service FinancialService {

    entity GruposContas           as projection on fin.GruposContas;
    entity Contas                 as projection on fin.Contas;
    entity Planejamentos          as projection on fin.Planejamentos;
    entity Lancamentos            as projection on fin.Lancamentos;
    entity RevisoesPlanejamento   as projection on fin.RevisoesPlanejamento;
    entity PlanosOrcamento        as projection on fin.PlanosOrcamento;
    entity PlanejamentosSnapshot  as projection on fin.PlanejamentosSnapshot;
    entity FormasPagamento        as projection on fin.FormasPagamento;

    /**
     * Linha do comparativo planejado x realizado por conta no mês.
     */
    type LinhaComparativa {
        conta_ID    : UUID;
        nomeConta   : String;
        grupo_ID    : UUID;
        nomeGrupo   : String;
        tipo        : String;
        cor         : String;
        ano         : Integer;
        mes         : Integer;
        planejado   : Decimal(15,2);
        realizado   : Decimal(15,2);
        diferenca   : Decimal(15,2);
        percentual  : Decimal(7,2);
    }

    /**
     * Resumo agregado do mês.
     */
    type ResumoMensal {
        ano                 : Integer;
        mes                 : Integer;
        receitaPlanejada    : Decimal(15,2);
        receitaRealizada    : Decimal(15,2);
        despesaPlanejada    : Decimal(15,2);
        despesaRealizada    : Decimal(15,2);
        reservaPlanejada    : Decimal(15,2);
        reservaRealizada    : Decimal(15,2);
        saldoPlanejado      : Decimal(15,2);
        saldoRealizado      : Decimal(15,2);
    }

    /**
     * Linha do planejamento anual: 12 valores (mensais) por conta.
     */
    type LinhaPlanoAnual {
        conta_ID        : UUID;
        nomeConta       : String;
        grupo_ID        : UUID;
        nomeGrupo       : String;
        tipo            : String;
        cor             : String;
        formula         : String;
        valores         : array of Decimal(15,2);  // length 12, índices 0..11 (jan..dez)
        manualPorMes    : array of Boolean;        // length 12 - se a célula foi editada manualmente
        revisoesPorMes  : array of Integer;        // length 12 - quantas revisões por mês
        total           : Decimal(15,2);
    }

    /**
     * Célula a ser atualizada via upsert anual.
     */
    type CelulaPlanoAnual {
        conta_ID : UUID;
        mes      : Integer;
        valor    : Decimal(15,2);
    }

    /**
     * Comparativo planejado x realizado por conta no mês.
     */
    function comparativoMensal(ano : Integer, mes : Integer) returns array of LinhaComparativa;

    /**
     * Resumo total (receitas, despesas, saldos) do mês.
     */
    function resumoMensal(ano : Integer, mes : Integer) returns ResumoMensal;

    /**
     * Grade de planejamento do ano todo: 12 valores por conta.
     */
    function planejamentoAnual(ano : Integer) returns array of LinhaPlanoAnual;

    /**
     * Cria ou atualiza valor planejado para uma conta em determinado mês.
     * Cada alteração é registrada em RevisoesPlanejamento (motivo opcional).
     */
    action upsertPlanejamento(
        conta      : UUID,
        ano        : Integer,
        mes        : Integer,
        valor      : Decimal(15,2),
        observacao : String(255),
        motivo     : String(255)
    ) returns Planejamentos;

    /**
     * Atualiza várias células do planejamento anual em lote.
     * Útil para o editor estilo planilha. Toda mudança gera revisão.
     */
    action upsertPlanejamentoAnual(
        ano     : Integer,
        celulas : array of CelulaPlanoAnual,
        motivo  : String(255)
    ) returns Integer;

    /**
     * Recalcula o valor planejado de todas as contas que têm fórmula
     * para o mês informado.
     */
    action recalcularPlanejamento(ano: Integer, mes: Integer) returns Integer;

    /**
     * Recalcula fórmulas para os 12 meses do ano.
     */
    action recalcularPlanejamentoAnual(ano: Integer) returns Integer;

    /**
     * Valida sintaxe de uma fórmula. Retorna string vazia se OK,
     * ou mensagem de erro descritiva.
     */
    action validarFormula(formula: String) returns String;

    /**
     * Garante que existe um PlanoOrcamento para o ano informado.
     * Cria como RASCUNHO com nome padrão se ainda não houver.
     */
    action garantirPlano(ano : Integer) returns PlanosOrcamento;

    /**
     * Renomeia o plano do ano.
     */
    action renomearPlano(
        ano  : Integer,
        nome : String(120),
        descricao : String(500),
    ) returns PlanosOrcamento;

    /**
     * Edita todos os campos do plano (nome, descrição, saldos anteriores).
     */
    action editarPlano(
        ano                    : Integer,
        nome                   : String(120),
        descricao              : String(500),
        saldoAnteriorReceitas  : Decimal(15,2),
        saldoAnteriorDespesas  : Decimal(15,2),
        saldoAnteriorReservas  : Decimal(15,2),
    ) returns PlanosOrcamento;

    /**
     * Publica o plano: passa a registrar revisões em alterações.
     */
    action publicarPlano(ano : Integer) returns PlanosOrcamento;

    /**
     * Volta o plano para rascunho (edições deixam de gerar revisões).
     */
    action voltarRascunho(ano : Integer) returns PlanosOrcamento;

    /**
     * Limpa todos os planejamentos do ano. Só permitido quando o plano
     * está em RASCUNHO. Apaga também as revisões do ano por consistência.
     */
    action limparPlano(ano : Integer) returns Integer;
}
