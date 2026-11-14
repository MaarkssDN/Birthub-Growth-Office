# Motor de ICP Comercial Dinâmico e Versionado
**Birthub Growth Office — Onda 12**

## 1. Princípios de Governança Comercial
1. **Fim dos Critérios Hardcoded:** As regras de qualificação de empresas e oportunidades agora derivam de perfis configuráveis de ICP (`CommercialIcpProfile`).
2. **Harmonização Scout & Meridian:** A Central Scout e o agente Meridian utilizam a mesma versão aprovada do perfil de ICP para avaliar contas e prioridades.
3. **Preservação de Versão Original:** Classificações históricas de empresas e oportunidades preservam os campos `icpProfileId` e `icpVersion`, garantindo auditabilidade temporal.
4. **Supervisão Humana Prévia:** Novas versões de regras entram como `draft`, são submetidas para aprovação com ação `icp.activate` e só vigoram após autorização explícita de um supervisor.
5. **Disclaimer Obrigatório (Honestidade de Estado):** O motor anexa obrigatoriamente a advertência:
   > *"Pontuação heurística de aderência ao ICP. Não representa prova nem garantia de intenção de compra."*

## 2. Dimensões e Regras de Avaliação
O motor de scoring (`packages/commercial/src/icp-engine.ts`) avalia 4 dimensões ponderadas (normalizadas entre 0 e 100):
- **CNAE (Classificação Nacional de Atividades Econômicas):** Compatibilidade com os códigos prioritários de TI, SaaS e consultoria.
- **Porte Empresarial:** Adequação à capacidade comercial (EPP, Médio, Grande).
- **Localização Geográfica:** Concentração em polos estratégicos (UFs do Sul e Sudeste).
- **Operação Comercial / Dados Cadastrais:** Regularidade cadastral ativa e presença de nome fantasia informado.

### Regras de Exclusão Estritas
Exclusões automáticas zeram o score (`score: 0`, `excluded: true`) e registram a justificativa explícita:
- Situação cadastral não ativa (inapta, baixada, suspensa ou nula).
- Porte incompatível com operação comercial estruturada (ex: MEI).

## 3. Comparação Entre Versões de ICP
A rota `/api/icp/compare` permite a comparação determinística de resultados entre duas versões de perfil para o mesmo dossiê empresarial:
- Diferença de pontuação (`scoreDifference`).
- Evidências adicionadas ou removidas.
- Lacunas identificadas em cada modelo.
- Validação do impacto antes da submissão da nova versão para aprovação humana.
