namespace br.com.financial;

using { cuid, managed } from '@sap/cds/common';

/**
 * Tipos de movimentação financeira.
 * - RECEITA: entrada de dinheiro (salário, freelas, etc).
 * - DESPESA: saída para gastos correntes.
 * - RESERVA: aporte em poupança/investimento. Não compõe o saldo
 *   operacional (receita-despesa), mas tem saldo acumulado próprio.
 */
type TipoMovimento : String enum {
    RECEITA;
    DESPESA;
    RESERVA;
}

/**
 * Status do Plano de Orçamento anual.
 * - RASCUNHO: edições livres, sem gerar revisão.
 * - PUBLICADO: cada alteração é registrada em RevisoesPlanejamento.
 */
type StatusPlano : String enum {
    RASCUNHO;
    PUBLICADO;
}

/**
 * Plano de Orçamento Anual: agrupa as metas (Planejamentos) de um ano
 * inteiro, com nome próprio e status. Há um plano por ano.
 *
 * Saldos anteriores: valores acumulados antes do início do ano,
 * usados como ponto de partida das somas cumulativas na planilha.
 */
entity PlanosOrcamento : cuid, managed {
    ano                    : Integer not null;
    nome                   : String(120);
    status                 : StatusPlano default 'RASCUNHO';
    descricao              : String(500);
    publicadoEm            : Timestamp;
    saldoAnteriorReceitas  : Decimal(15,2) default 0;
    saldoAnteriorDespesas  : Decimal(15,2) default 0;
    saldoAnteriorReservas  : Decimal(15,2) default 0;
}

/**
 * Grupo de contas. Ex.: "Moradia", "Alimentação", "Salário".
 * Reúne contas (categorias) afins para facilitar consolidação.
 */
entity GruposContas : cuid, managed {
    nome      : String(80) not null;
    tipo      : TipoMovimento not null;
    descricao : String(255);
    icone     : String(40);
    cor       : String(20);
    ativo     : Boolean default true;
    contas    : Composition of many Contas on contas.grupo = $self;
}

/**
 * Conta/categoria específica dentro de um grupo.
 * Ex.: dentro de "Moradia": "Aluguel", "Energia", "Internet".
 */
entity Contas : cuid, managed {
    grupo     : Association to GruposContas not null;
    nome      : String(80) not null;
    descricao : String(255);
    /**
     * Fórmula opcional para calcular o valor planejado automaticamente.
     * Tokens: %RECEITA, %DESPESA, %GRUPO[Nome], %CONTA[Nome].
     * Ex.: "10% * %RECEITA" (dízimo) — recalculado a cada salvamento do plano.
     */
    formula   : String(500);
    ativo     : Boolean default true;
    planos       : Composition of many Planejamentos on planos.conta = $self;
    lancamentos  : Composition of many Lancamentos on lancamentos.conta = $self;
}

/**
 * Planejamento mensal: valor previsto para a conta no mês/ano.
 *
 * O campo `manual` indica que o valor foi editado diretamente pelo usuário
 * (override). Recálculos de fórmula PULAM células marcadas como manual,
 * preservando o ajuste personalizado.
 */
entity Planejamentos : cuid, managed {
    conta           : Association to Contas not null;
    ano             : Integer not null;
    mes             : Integer not null; // 1..12
    valorPlanejado  : Decimal(15,2) not null default 0;
    manual          : Boolean default false;
    observacao      : String(255);
    revisoes        : Composition of many RevisoesPlanejamento on revisoes.planejamento = $self;
}

/**
 * Histórico de alterações de um planejamento.
 * Cada vez que o valor de um Planejamento muda, registramos aqui o antes/depois.
 */
entity RevisoesPlanejamento : cuid, managed {
    planejamento   : Association to Planejamentos not null;
    conta          : Association to Contas not null;
    ano            : Integer not null;
    mes            : Integer not null;
    valorAnterior  : Decimal(15,2);
    valorNovo      : Decimal(15,2) not null;
    motivo         : String(255);
}

/**
 * Tipos de forma de pagamento.
 */
type TipoFormaPagamento : String enum {
    PIX;
    DEBITO;
    CREDITO;
    DINHEIRO;
    BOLETO;
    TRANSFERENCIA;
    OUTRO;
}

/**
 * Cadastro de formas de pagamento (cartões, contas, PIX, etc).
 */
entity FormasPagamento : cuid, managed {
    nome      : String(80) not null;
    tipo      : TipoFormaPagamento;
    banco     : String(60);
    descricao : String(255);
    cor       : String(20);
    ativo     : Boolean default true;
}

/**
 * Lançamento real (receita, despesa ou aporte efetivo).
 *
 * Quando `recorrencias > 1` (ex.: parcelado em N x), o sistema cria
 * automaticamente projeções no Planejamento dos meses seguintes,
 * considerando o lançamento atual como a primeira parcela.
 */
entity Lancamentos : cuid, managed {
    conta          : Association to Contas not null;
    data           : Date not null;
    descricao      : String(255);
    valor          : Decimal(15,2) not null;
    pago           : Boolean default true;
    pagamento      : Association to FormasPagamento;
    recorrencias   : Integer default 1; // total de parcelas (1 = sem recorrência)
}

/**
 * Snapshot dos valores planejados no momento da publicação do plano.
 * Usado para comparar o "plano publicado" original com o estado atual.
 */
entity PlanejamentosSnapshot : cuid, managed {
    plano       : Association to PlanosOrcamento not null;
    conta       : Association to Contas not null;
    ano         : Integer not null;
    mes         : Integer not null;
    valorPublicado : Decimal(15,2) not null;
}
