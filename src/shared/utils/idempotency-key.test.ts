import { describe, it, expect } from "vitest";

import {
  createIdempotencyKeeper,
  generateIdempotencyKey,
} from "./idempotency-key";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateIdempotencyKey", () => {
  it("gera UUID v4 diferente a cada chamada", () => {
    const a = generateIdempotencyKey();
    const b = generateIdempotencyKey();

    expect(a).toMatch(UUID_RE);
    expect(b).toMatch(UUID_RE);
    expect(a).not.toBe(b);
  });
});

describe("createIdempotencyKeeper", () => {
  it("devolve a mesma chave para o mesmo conteúdo (reenvio após falha)", () => {
    const keyFor = createIdempotencyKeeper();

    const first = keyFor('{"title":"Oi"}');

    expect(first).toMatch(UUID_RE);
    expect(keyFor('{"title":"Oi"}')).toBe(first);
    expect(keyFor('{"title":"Oi"}')).toBe(first);
  });

  it("dá chave própria a conteúdo diferente (é outro envio)", () => {
    const keyFor = createIdempotencyKeeper();

    const first = keyFor('{"title":"Oi"}');
    const second = keyFor('{"title":"Tchau"}');

    expect(second).toMatch(UUID_RE);
    expect(second).not.toBe(first);
  });

  it("voltar a um conteúdo anterior devolve a chave que ele já tinha", () => {
    const keyFor = createIdempotencyKeeper();

    const original = keyFor("A");
    keyFor("B");

    // Se o "A" original chegou ao servidor, reenviá-lo com outra chave duplicaria.
    expect(keyFor("A")).toBe(original);
  });

  it("não compartilha chaves entre keepers (cada formulário aberto tem o seu)", () => {
    expect(createIdempotencyKeeper()("A")).not.toBe(createIdempotencyKeeper()("A"));
  });
});
