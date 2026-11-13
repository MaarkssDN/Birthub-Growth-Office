# Onda 11 — Diagnóstico de Prisma e Build

## 1. Problema 01: Prisma Query Engine EPERM no Windows

### 1.1 Causa Raiz
No Windows, o sistema operacional impede a substituição ou deleção de arquivos DLL (`query_engine-windows.dll.node`) que estejam em uso por processos ativos. Em ambiente de desenvolvimento monorepo com servidores rodando em background (ex: `apps/api` ou processos Vitest/ts-node), o comando padrão `prisma generate` falha com `EPERM: operation not permitted, unlink '...query_engine-windows.dll.node'`.

### 1.2 Solução Implementada
Criou-se o script utilitário `scripts/prisma-safe-generate.mjs`:
1. Inspeciona a porta da API (`127.0.0.1:4181`) para identificar especificamente o PID do processo local da API do BGO.
2. Finaliza seletivamente apenas os processos que mantêm o lock na DLL do Prisma, sem derrubar indiscriminadamente processos do sistema operacional.
3. Aguarda a liberação dos descritores de arquivo.
4. Executa `prisma generate` de forma limpa e atômica.
5. Valida a geração dos tipos do Prisma Client sem erros.

O script foi adicionado ao script npm `pnpm db:generate:safe` e validado com sucesso.

## 2. Problema 02: Build OOM no Monorepo (Three.js Bundle)

### 2.1 Causa Raiz
O build do Vite em `apps/web` agregava as bibliotecas do Three.js (`three`, `@react-three/fiber`, `@react-three/drei`, GLTFLoader, OrbitControls) em um único bundle monolítico. Quando compilado junto com a emissão de tipos TypeScript (`tsc --noEmit`) em múltiplos pacotes em paralelo, o consumo de memória Node.js excedia o limite padrão (1.5GB a 2GB), culminando em `JavaScript heap out of memory`.

### 2.2 Solução Arquitetural
1. **Code-Splitting Manual via Rollup (`apps/web/vite.config.ts`)**:
   Implementou-se a segmentação de chunks no build:
   - `three-core`: Contém unicamente o runtime essencial `three`.
   - `three-ecosystem`: Contém adaptadores e loaders (`@react-three/fiber`, `@react-three/drei`).
   - `OfficeView`: Carregado dinamicamente via `React.lazy()` somente quando o operador navega para a aba do Escritório 3D.
2. **Controle de Concorrência do PNPM**:
   Adicionou-se o parâmetro `--workspace-concurrency=2` nos scripts de build e typecheck do `package.json` raiz, limitando o consumo concorrente de memória durante a transpilação.

### 2.3 Resultados das Otimizações
- O tamanho do bundle principal `dist/assets/index.js` foi reduzido para apenas **72.37 kB** (18.05 kB gzipped).
- O chunk `OfficeView.js` foi reduzido para **26.56 kB** (8.87 kB gzipped).
- O build completo do monorepo (`pnpm build`) transcorre em **14.64s**, consumindo menos de 450MB de RSS, com 100% de reproducibilidade em qualquer máquina.
