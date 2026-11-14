# Governança da Oferta Comercial e Gestão de Claims
**Birthub Growth Office — Onda 12**

## 1. Diretriz Inviolável (Regra 4 de AGENTS.md)
> *"Sem claims não validados em saídas voltadas a cliente: OfferClaim com status approved é pré-requisito; PENDENTE_DE_VALIDACAO bloqueia uso."*

É expressamente proibido aos agentes inventar preços, prazos, SLAs, garantias ou cases fictícios em qualquer comunicação comercial.

## 2. Catálogo Canônico de Ofertas (`CommercialOfferItem`)
A plataforma gerencia o repositório centralizado de alegações comerciais classificadas em categorias canônicas:
- `value_prop`: Proposta central de valor da solução.
- `feature`: Funcionalidades verificadas e testadas.
- `differentiator`: Diferenciais competitivos comprovados.
- `target_audience`: Segmentos e personas homologadas.
- `contract_term`: Modelos contratuais autorizados pelo jurídico.
- `objection_response`: Respostas padrão a objeções comuns.

### Status dos Itens de Oferta
1. `approved`: Alegação revisada e autorizada por supervisor humano, com evidência documental vinculada (`evidenceUrl`). Liberada para uso pelo Beacon.
2. `pending_validation`: Alegação nova ou em análise. **Bloqueia a aprovação de qualquer rascunho de comunicação que a referencie**.
3. `rejected`: Alegação recusada por inconformidade técnica ou jurídica.
4. `archived`: Alegação descontinuada.

## 3. Validador de Alegações (`validateDraftClaims`)
Antes de submeter um rascunho para aprovação humana, o validador inspeciona todas as referências (`claimRefs`):
- Se houver qualquer claim inexistente ou com status `pending_validation`, a validação falha e o rascunho é impedido de avançar.
- O validador exige que ao menos um claim aprovado seja expressamente referenciado para garantir respaldo factual.
- A aprovação de novos itens do catálogo é realizada na Central de Aprovações sob a ação `offer.approve`.
