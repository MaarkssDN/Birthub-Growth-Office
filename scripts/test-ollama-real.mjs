async function main() {
  const res = await fetch("http://127.0.0.1:11434/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen2.5:0.5b",
      messages: [
        {
          role: "system",
          content:
            "Você é Meridian, qualificador SDR do BGO. Responda APENAS JSON válido no formato: {\"diagnosis\": string, \"justification\": string, \"confidence\": number, \"nextAction\": string, \"claimRefs\": []}",
        },
        {
          role: "user",
          content: JSON.stringify({
            lead: {
              name: "Alfa Transportes e Logística LTDA",
              segment: "Logística",
              synthetic: true,
            },
            icp: { targetSegment: "Logística" },
            approvedClaims: ["claim-1"],
          }),
        },
      ],
      max_tokens: 300,
      temperature: 0.1,
    }),
  });

  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Modelo:", data.model);
  console.log("Tokens in:", data.usage?.prompt_tokens, "Tokens out:", data.usage?.completion_tokens);
  console.log("Conteúdo gerado:", data.choices?.[0]?.message?.content);
}

main().catch(console.error);
