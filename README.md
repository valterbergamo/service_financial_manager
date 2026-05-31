# Planejamento financeiro

Gerenciador Planejamento financeiro completo: planejamento mensal de entradas e saídas, lançamento de receitas e despesas reais, e comparativo **planejado x realizado** mês a mês.

Repositório separado em dois projetos:

- [backend/](backend/) — SAP **CAP (CDS)** com SQLite
- [frontend/](frontend/) — **React + Vite + TypeScript**, responsivo (mobile-first)

---

## Funcionalidades

- **Grupos de contas**: organize categorias por tipo (Receita / Despesa) — ex.: *Moradia*, *Alimentação*, *Salário*.
- **Contas (categorias)**: subdivisões de cada grupo — ex.: *Aluguel*, *Energia*, *Mercado*.
- **Planejamento mensal**: defina o valor previsto de cada conta para cada mês.
- **Lançamentos**: registre receitas e despesas reais com data, valor e descrição.
- **Comparativo Real x Planejado**: visualização por grupo com barras de progresso e diferença.
- **Dashboard**: resumo do mês com saldo, top despesas e progresso do plano.
- **Navegação por mês**: troque o período no topo e todas as telas seguem o mesmo mês.

---

## Backend (CAP)

### Pré-requisitos

- Node.js 18+
- (Opcional) `@sap/cds-dk` global: `npm i -g @sap/cds-dk`

### Como rodar

```bash
cd backend
npm install
npm run deploy   # cria db/financial.sqlite com dados de exemplo
npm run watch    # inicia o serviço em http://localhost:4004
```

Após subir, abra `http://localhost:4004` para o catálogo do serviço.

### Endpoints

Base: `/financial`

| Recurso                              | Descrição                                    |
| ------------------------------------ | -------------------------------------------- |
| `GET/POST/PATCH/DELETE GruposContas` | CRUD de grupos                               |
| `GET/POST/PATCH/DELETE Contas`       | CRUD de contas                               |
| `GET/POST/PATCH/DELETE Planejamentos`| CRUD de planos mensais                       |
| `GET/POST/PATCH/DELETE Lancamentos`  | CRUD de lançamentos reais                    |
| `GET comparativoMensal(ano,mes)`     | Comparativo por conta no mês                 |
| `GET resumoMensal(ano,mes)`          | Totais consolidados do mês                   |
| `POST upsertPlanejamento`            | Cria ou atualiza valor planejado de uma conta|

### Modelo de dados

Definido em [backend/db/schema.cds](backend/db/schema.cds):

- **GruposContas** (nome, tipo: RECEITA/DESPESA, cor, ícone)
- **Contas** (nome, grupo)
- **Planejamentos** (conta, ano, mês, valorPlanejado)
- **Lancamentos** (conta, data, descrição, valor, pago, formaPagamento)

---

## Frontend (React + Vite)

### Pré-requisitos

- Node.js 18+

### Como rodar

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

O Vite faz proxy de `/financial` para `http://localhost:4004` (CAP). Suba o backend antes.

### Build de produção

```bash
npm run build
npm run preview
```

### Telas

| Rota              | Tela                                             |
| ----------------- | ------------------------------------------------ |
| `/`               | Dashboard com resumo do mês e top despesas       |
| `/planejamento`   | Planejar valores por conta no mês                |
| `/lancamentos`    | Lançar receitas e despesas reais                 |
| `/comparativo`    | Comparativo Real x Planejado por grupo           |
| `/contas`         | Gerenciar grupos e contas                        |

---

## Fluxo recomendado

1. **Crie grupos e contas** em *Contas* (já vem com dados de exemplo).
2. No início do mês, abra *Plano* e informe quanto planeja **receber** e **gastar** em cada conta.
3. Durante o mês, registre os lançamentos reais em *Lançar*.
4. Acompanhe em *Real x Plan.* o quanto está dentro/fora do orçamento.
5. Use o seletor de mês no topo para navegar para meses anteriores ou planejar os próximos.

---

## Estrutura

```
financial/
├── backend/
│   ├── db/
│   │   ├── schema.cds              # modelo CDS
│   │   └── data/                   # CSVs de exemplo
│   ├── srv/
│   │   ├── financial-service.cds   # service definition
│   │   └── financial-service.js    # handlers (comparativo, resumo, upsert)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api.ts                  # client OData
    │   ├── components/             # Layout, Modal, EmptyState
    │   ├── context/                # Periodo, Toast
    │   ├── pages/                  # Dashboard, Planejamento, Lançamentos, Comparativo, Contas
    │   ├── styles/global.css       # tema mobile-first
    │   ├── types.ts
    │   ├── utils.ts
    │   ├── App.tsx
    │   └── main.tsx
    ├── index.html
    ├── tsconfig.json
    ├── vite.config.ts              # proxy /financial -> :4004
    └── package.json
```
