async function test() {
  const loginRes = await fetch("http://127.0.0.1:4181/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@bgo.local", password: "bgo-dev-local-2026" }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log("Logged in as:", loginData.user?.email, "token:", Boolean(token));

  // Teste de conexão Ollama
  const testRes = await fetch("http://127.0.0.1:4181/api/ai/providers/ollama/test", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const testData = await testRes.json();
  console.log("Teste Provedor Ollama:", JSON.stringify(testData, null, 2));

  // Teste Meridian Diagnose com Ollama Real
  const diagRes = await fetch("http://127.0.0.1:4181/api/ai/meridian-diagnose", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      lead: {
        name: "Transportes Rodoviários Brasil S.A.",
        company: "Transportes Rodoviários Brasil",
        interest: "Esteira comercial e qualificação automática de frota",
        synthetic: true,
      },
      preferredProvider: "ollama",
      forceReal: true,
    }),
  });
  const diagData = await diagRes.json();
  console.log("Diagnóstico Meridian Real via API:", JSON.stringify(diagData, null, 2));
}

test().catch(console.error);
