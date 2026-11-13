# Scout — importação CSV autorizada
`packages/commercial/src/scout-import.ts`:
- parseCsv com cabeçalho, limite 5000 linhas, rejeição de CSV inválido
- normalizeCnpj/isValidCnpj — dígitos verificadores reais
- dedup por CNPJ 14 dígitos; mapeamento de colunas PT/EN
- scoreIcp heurístico (situação/porte/CNAE/município) — NÃO é evidência
  de intenção de compra; reasons+gaps por empresa; ordenado por score
- fonte+importadoEm registrados por registro
API: POST /api/scout/import (auth, ≤2MB, audit scout.import).
Testes: tests/unit/scout-import.test.ts — 3/3.
Sem scraping/dados pessoais de sócios.
