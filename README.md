# API Monitor Backend

Backend API para o sistema de monitoramento de APIs.

## Tecnologias

- Node.js
- Express.js
- MongoDB
- Docker

## Configuração

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `.env.example` para `.env` e configure as variáveis.

### 3. Iniciar MongoDB com Docker
```bash
npm run docker:up
```

### 4. Executar o servidor
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## Endpoints da API

### Conexões
- `GET /api/connections` - Listar conexões
- `POST /api/connections` - Criar conexão
- `PUT /api/connections/:id` - Atualizar conexão
- `DELETE /api/connections/:id` - Deletar conexão
- `GET /api/connections/:id` - Buscar conexão por ID
- `POST /api/connections/:id/test` - Testar conexão

### Utilitários
- `GET /api/health` - Health check

## Scripts disponíveis

- `npm start` - Executar em produção
- `npm run dev` - Executar em desenvolvimento
- `npm run docker:up` - Subir containers Docker
- `npm run docker:down` - Parar containers Docker
- `npm run docker:logs` - Ver logs dos containers


- npm install express mongodb cors axios xml2js dotenv
- npm install -D nodemon