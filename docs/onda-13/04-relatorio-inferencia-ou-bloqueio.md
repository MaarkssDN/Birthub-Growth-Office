# Relatório de Inferência Real e Bloqueio Honesto de IA — Onda 13
## Diagnóstico do Meridian e Status do AI Gateway (G172)

### 1. Declaração Obrigatória de Honestidade de Estado
Em estrito cumprimento à **Regra 07 de Honestidade de Estado do `AGENTS.md`**, o Birthub Growth Office declara que:
- A variável de ambiente `BGO_AI_API_KEY` **não está configurada** no ambiente de execução atual.
- Nenhum provedor externo pago (OpenAI, Anthropic, Google Gemini API) foi acionado sem chave autorizada ou por simulação fingida de chamadas de rede.
- O Gate **G172** está formal e honestamente classificado como:
  ```
  STATUS: BLOQUEADO POR CREDENCIAL (MODO DETERMINÍSTICO ATIVO)
  ```

---

### 2. Mecanismo de Fallback Determinístico do Meridian

O agente **Meridian** possui implementação comutada que opera em modo determinístico auditado quando a credencial de IA não está presente:
1. **Entrada Estruturada**: Recebe os dados da empresa/lead, pontuação preliminar do Scout, dados cadastrais de CNAE, porte e respostas ao formulário.
2. **Motor de Regras ICP**: Avalia a aderência contra a versão ativa do perfil de ICP (`DEFAULT_COMMERCIAL_ICP_PROFILE` ou versão homologada via `IcpStorePort`).
3. **Contrato de Saída Estruturada (`StructuredAgentOutput`)**:
   - `facts`: Fatos verificados comprovados por dados cadastrais e consentimento.
   - `inferences`: Inferências estatísticas de pontuação e priorização comercial.
   - `recommendations`: Recomendações de abordagem comercial supervisionada.
4. **Metadados de Execução Registrados**:
   - `provider`: `"mock_deterministic"`
   - `model`: `"deterministic-icp-v1"`
   - `simulated`: `true`
   - `latencyMs`: 220ms
   - `costUnits`: 0.005 unidades (tarifa determinística)

---

### 3. Proteção contra Prompt Injection e Envenenamento de Dados

Para assegurar a operação do piloto contra tentativas de manipulação via formulários externos ou campos abertos de interesse:
- O payload de entrada passa por sanitização estrita via Zod (`CreateLeadInput` / `CaptureFormInput`).
- Campos de texto livre (`interest`, `notes`, `nomeFantasia`) têm tamanho máximo restrito e são encapsulados em blocos de dados inertes (`data blocks`), impedindo que instruções presentes em campos abertos alterem o comportamento do agente ou do validador de políticas.
- A decisão de transição de estágio permanece governada por máquina de estados determinística (`OPPORTUNITY_TRANSITIONS`), sendo imune a comandos injetados em texto.

---

### 4. Condições para Ativação de Inferência Externa na Onda 14
A ativação de inferência real via AI Gateway requer:
1. Injeção segura de chave de API em ambiente confidencial (nunca comitada no Git).
2. Validação prévia de orçamento diário e mensal via `CostLedger`.
3. Validação do schema de retorno com `StructuredAgentOutput`.
4. Anonimização prévia de quaisquer dados pessoais não sintéticos.
