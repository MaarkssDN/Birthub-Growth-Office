# Manual de Operação — Onda 12
**Birthub Growth Office — Operação Comercial Integrada**

## 1. Como Iniciar o Ambiente de Desenvolvimento
Certifique-se de que o PostgreSQL (porta 5437) e o Memurai/Redis (porta 6387) estejam ativos no host local (`127.0.0.1`).

```bash
# Instalação de dependências
pnpm install

# Aplicação de migrações e geração segura do cliente Prisma
node scripts/prisma-safe-generate.mjs --deploy

# Inicialização da API (127.0.0.1:4181)
pnpm dev:api

# Inicialização do Frontend Web (127.0.0.1:4180)
pnpm dev:web
```

## 2. Fluxo Operacional Recomendado

### 2.1 Gestão do ICP Dinâmico
1. Acesse a aba **ICP Dinâmico** na barra superior.
2. Visualize o perfil atualmente ativo (ex: *B2B Tecnologia & Serviços Especializados v1*).
3. Para ajustar critérios ou pesos, clique em **Nova Versão / Ajustar Critérios**.
4. Defina os novos pesos e justificativa da mudança. O perfil será criado como `draft`.
5. Clique em **Submeter para Aprovação Humana**.
6. Acesse a aba **Aprovações** com credencial de supervisor (`approver` ou `owner`) e aprove a ativação do perfil. O novo perfil passará imediatamente a orientar o Scout e o Meridian.

### 2.2 Governança da Oferta Comercial
1. Acesse a aba **Oferta Comercial**.
2. Revise os itens aprovados e pendentes.
3. Para registrar uma nova alegação comercial (ex: novo case ou funcionalidade), clique em **Nova Alegação**.
4. Preencha título, categoria e a URL da evidência documental. O item será registrado como `pending_validation`.
5. Na Central de Aprovações, aprove o item para que o Beacon possa utilizá-lo em abordagens comerciais.

### 2.3 Simulação no Sandbox de Comunicação
1. Acesse a aba **Comunicação**.
2. No painel de teste de sandbox, insira um destinatário sintético e selecione o canal pretendido.
3. Escolha o cenário de simulação desejado (`success`, `network_timeout`, `bounce`, `rate_limit`, `suppressed`).
4. Clique em **Executar Disparo de Teste (Sandbox)**.
5. Verifique o resultado simulado no histórico de disparos, com cabeçalhos de auditoria e mascaramento de dados pessoais. **Nenhum e-mail ou mensagem real será disparada para a internet**.

### 2.4 Escritório Virtual 3D
1. Acesse a aba **Escritório**.
2. Clique sobre qualquer um dos 6 bonequinhos procedurais para abrir seu painel contextual.
3. Observe os dados em tempo real: o Scout exibirá o ICP ativo, o Meridian mostrará Fatos, Inferências e Recomendações, o Beacon indicará claims auditados e o Pledge mostrará aprovações e despachos de sandbox.
