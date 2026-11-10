#!/usr/bin/env node
// Migração t4 (contas bancárias): cria BB, Bradesco, Visa Vale e Dinheiro e põe a conta bancária nos
// lançamentos que não têm. Roda pela API (padrão http://localhost:6070/financial), é idempotente
// e não apaga nada. Uso: node scripts/migrar-t4.js [--aplicar]   (sem --aplicar só mostra o que faria)
const BASE = (process.env.FINANCAS_API || 'http://localhost:6070/financial').replace(/\/$/, '');
const aplicar = process.argv.includes('--aplicar');
const LOTE_BRADESCO = '20261109-2104-cca4';

async function api(caminho, init = {}) {
  const r = await fetch(BASE + caminho, { ...init, headers: { 'Content-Type': 'application/json' } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${caminho}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
const lista = async (c) => (await api(c)).value;

(async () => {
  let bancos = await lista('/ContasBancarias?$orderby=ordem');
  if (!bancos.length) {
    const planos = await lista('/PlanosOrcamento?$filter=ano eq 2026');
    const p = planos[0] || {};
    // Saldo de abertura de 2026 que o cálculo antigo usava (receitas − despesas − reservas)
    const abertura = Math.round(((+p.saldoAnteriorReceitas || 0) - (+p.saldoAnteriorDespesas || 0) - (+p.saldoAnteriorReservas || 0)) * 100) / 100;
    const novas = [
      { nome: 'Banco do Brasil', tipo: 'CORRENTE', saldoInicial: abertura, dataReferencia: '2026-01-01', cor: '#facc15', ordem: 1 },
      { nome: 'Bradesco', tipo: 'CORRENTE', saldoInicial: 0, dataReferencia: '2026-01-01', cor: '#ef4444', ordem: 2 },
      { nome: 'Visa Vale', tipo: 'VALE', saldoInicial: 0, dataReferencia: '2026-01-01', cor: '#22c55e', ordem: 3 },
      { nome: 'Dinheiro', tipo: 'DINHEIRO', saldoInicial: 0, dataReferencia: '2026-01-01', cor: '#64748b', ordem: 4 },
    ];
    console.log('contas bancárias a criar:', JSON.stringify(novas));
    if (aplicar) for (const n of novas) await api('/ContasBancarias', { method: 'POST', body: JSON.stringify(n) });
    bancos = aplicar ? await lista('/ContasBancarias?$orderby=ordem') : novas.map((n) => ({ ...n, ID: n.nome }));
  }
  const id = (nome) => bancos.find((b) => b.nome === nome)?.ID;
  const formasVale = new Set((await lista('/FormasPagamento')).filter((f) => f.tipo === 'VALE').map((f) => f.ID));
  const lancs = await lista('/Lancamentos?$select=ID,origem,pagamento_ID,contaBancaria_ID&$top=100000');
  const cont = { BB: 0, Bradesco: 0, 'Visa Vale': 0 };
  for (const l of lancs.filter((x) => !x.contaBancaria_ID)) {
    const nome = formasVale.has(l.pagamento_ID) ? 'Visa Vale' : String(l.origem || '').includes(LOTE_BRADESCO) ? 'Bradesco' : 'BB';
    cont[nome === 'BB' ? 'BB' : nome]++;
    if (aplicar) await api(`/Lancamentos(${l.ID})`, { method: 'PATCH', body: JSON.stringify({ contaBancaria_ID: id(nome === 'BB' ? 'Banco do Brasil' : nome) }) });
  }
  console.log(aplicar ? 'aplicado' : 'simulação', 'lançamentos por conta:', JSON.stringify(cont));
})().catch((e) => { console.error(e.message); process.exit(1); });
