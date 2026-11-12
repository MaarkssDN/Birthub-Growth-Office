import { describe, expect, it } from "vitest";
import { OFFER_CLAIMS, approvedClaimIds, claimsForDraft } from "@bgo/commercial";

describe("catálogo de claims comerciais (G00)", () => {
  it("todo claim tem classificação válida", () => {
    for (const c of OFFER_CLAIMS) {
      expect(["approved", "pending", "rejected"]).toContain(c.status);
      expect(c.version).toBe("offer-v1");
    }
  });

  it("somente o nome do produto está aprovado; preço/features são pendentes", () => {
    const approved = approvedClaimIds();
    expect(approved).toEqual(["claim-name"]);
    const pricing = OFFER_CLAIMS.find((c) => c.id === "claim-pricing")!;
    expect(pricing.status).toBe("pending");
  });

  it("drafts só podem referenciar claims aprovados", () => {
    const draftClaims = claimsForDraft();
    expect(draftClaims).toHaveLength(1);
    expect(draftClaims[0]!.id).toBe("claim-name");
  });
});
