# Onda 04 — Guia de Identidade Visual "Comercial Enlouquecidamente"

## Conceito
Bonequinhos 3D de proporções cartoon (cápsula + cabeça esférica grande),
expressividade facial forte, materiais estilizados, iluminação cinematográfica.
Designs 100% originais — nenhuma referência a personagens de filmes.

## Paleta oficial (Birthub 360°)
| Cor | Hex | Uso |
|---|---|---|
| Azul neon | `#00D4FF` | secundário Relay, estados listening |
| Rosa neon | `#FF2D9B` | destaque Beacon, estado speaking |
| Dourado | `#FFC107` | Aegis, success, relatórios |
| Íris | `#8B7DFF` | detalhes Aegis/Meridian |

Corpo: pele `#F5F0E8`, tinta `#14161C`, escuro `#1B1E26`.

## Linguagem facial (v2 — `characterModel.ts`)
- Olhos grandes brancos com **íris na cor accent do agente**, pupila e
  brilho especular — cada agente "olha" com sua cor.
- Sobrancelhas expressivas inclinadas por lado.
- Boca em sorriso sutil (torus), blush nas cores do agente.

## Silhueta/acessório por função
- **Aegis**: manto hexagonal + coroa de 5 cones dourados + gema íris.
- **Relay**: headset com hastes e LED cyan + crachá.
- **Scout**: chapéu fedora + fita + lupa dourada.
- **Meridian**: óculos redondos com lente azul + prancheta com barras de gráfico.
- **Beacon**: antena com orbe rosa pulsante + megafone + raio no peito.
- **Pledge**: relógio dourado + agenda/crachá + argola.

## Animação (runtime, dirigida por eventos reais)
`STATE_TUNE` em `characters.tsx`: bob/amplitude, velocidade, pulse de escala
e shake por estado `idle|listening|processing|speaking|success|error`.
`prefers-reduced-motion` zera amplitudes. Clips esqueléticos nomeados
iguais aos estados ficam reservados para GLBs rigados (Onda 05).
