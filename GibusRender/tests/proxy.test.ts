import { describe, expect, it } from "vitest";
import { checkBasicAuth } from "@/proxy";

describe("checkBasicAuth", () => {
  it("senza header è non autorizzato", () => {
    expect(checkBasicAuth(null, "a:b", true)).toBe("unauthorized");
  });
  it("accetta credenziali valide tra più utenti", () => {
    expect(checkBasicAuth("Basic " + btoa("a:b"), "a:b,c:d", true)).toBe("ok");
  });
  it("rifiuta password errata", () => {
    expect(checkBasicAuth("Basic " + btoa("c:x"), "a:b,c:d", true)).toBe("unauthorized");
  });
  it("senza variabile: 503 in produzione, libero in sviluppo", () => {
    expect(checkBasicAuth(null, undefined, true)).toBe("misconfigured");
    expect(checkBasicAuth(null, undefined, false)).toBe("ok");
  });
  it("password con due punti", () => {
    expect(checkBasicAuth("Basic " + btoa("a:b:c"), "a:b:c", true)).toBe("ok");
  });
  it("header non Basic o malformato è non autorizzato", () => {
    expect(checkBasicAuth("Bearer xyz", "a:b", true)).toBe("unauthorized");
    expect(checkBasicAuth("Basic !!!", "a:b", true)).toBe("unauthorized");
  });
});
