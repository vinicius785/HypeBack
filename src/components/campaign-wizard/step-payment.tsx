import { useState } from "react";

import { I } from "@/components/prototype/ui";
import type { CampaignFormData, CampaignProductDraft } from "@/shared/types";

import { Field, FieldError, ListBox, MoneyInput, SectionCard, ToggleRow } from "./fields";
import type { WizardStepProps } from "./types";

const PAYS: Array<[string, string, string]> = [
  ["fixed", "Valor fixo por conteúdo", "Você define quanto paga por conteúdo publicado"],
  ["price", "Preço definido pelo influenciador", "Cada criador propõe o próprio valor ao se candidatar"],
  ["individual_price", "Valor individual por criador", "Você negocia e define o valor de cada pessoa"],
  ["swap", "Permuta", "O pagamento é em produtos ou serviços"],
  ["cpa", "CPA (custo por ação)", "Paga por ações geradas, como cliques e compras"],
  ["cpm", "CPM (custo por mil)", "Paga por mil visualizações do conteúdo"],
];
const PICON: Record<string, string> = {
  fixed: "banknote",
  price: "tag",
  individual_price: "users",
  swap: "box",
  cpa: "pointer",
  cpm: "eye",
};
const PSHORT: Record<string, string> = {
  fixed: "Valor fixo",
  price: "Preço do influenciador",
  individual_price: "Valor individual",
  swap: "Permuta",
  cpa: "CPA",
  cpm: "CPM",
};

function emptyProduct(): CampaignProductDraft {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    description: "",
    market_value: "",
    weight_grams: "",
    width_cm: "",
    height_cm: "",
    length_cm: "",
    brand: "",
    sku: "",
    notes: "",
    images: [],
    pendingImageFiles: [],
  };
}

type SecKey = "bonus" | "benefits" | "products";

export function StepPayment({ formData, updateFormData, tried }: WizardStepProps) {
  const set = (f: keyof CampaignFormData, v: unknown) => updateFormData(f, v);
  const [bonusOn, setBonusOn] = useState(!!formData.benefitsBonus?.trim());
  const [sec, setSec] = useState<SecKey | null>(null);

  const pay = PAYS.find((p) => p[0] === formData.paymentType);
  const benefits = (Array.isArray(formData.benefits) ? formData.benefits : []).filter((b) => b.trim() !== "");
  const products = formData.products ?? [];

  const setBenefits = (next: string[]) => set("benefits", next.length ? next : [""]);
  const setProducts = (next: CampaignProductDraft[]) => set("products", next);
  const patchProduct = (id: string, patch: Partial<CampaignProductDraft>) =>
    setProducts(products.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const toggleBonus = (on: boolean) => {
    setBonusOn(on);
    if (!on) set("benefitsBonus", "");
  };

  const brand = "Marca";
  let extra: React.ReactNode = null;
  switch (formData.paymentType) {
    case "fixed":
      extra = (
        <div className="pd one">
          <div className="pscene">
            <div className="bill">
              <i className="bl1" />
              <i className="bl2" />
              <span className="bsh" />
              <div className="bm">
                <em>R$</em>
                <input
                  className="ni"
                  inputMode="numeric"
                  placeholder="0,00"
                  autoComplete="off"
                  aria-label="Valor por conteúdo"
                  value={formData.paymentFixedAmount ?? ""}
                  onChange={(e) => set("paymentFixedAmount", maskInline(e.target.value))}
                />
              </div>
              <small>por conteúdo publicado</small>
              <u className="bc c1" />
              <u className="bc c2" />
            </div>
          </div>
        </div>
      );
      break;
    case "swap":
      extra = (
        <div className="pd">
          <div className="pscene">
            <div className="box">
              <div className="bx-b" />
              <div className="bx-l" />
              <div className="bx-t">
                <b>{brand}</b>
                <small>PERMUTA</small>
              </div>
              <i className="sp s1" />
              <i className="sp s2" />
              <i className="sp s3" />
            </div>
          </div>
          <div className="pfields">
            <Field label="Item oferecido">
              <input
                className="ni"
                placeholder="Ex.: kit exclusivo com 3 produtos"
                autoComplete="off"
                value={formData.paymentSwapItem ?? ""}
                onChange={(e) => set("paymentSwapItem", e.target.value)}
              />
            </Field>
            <Field label="Valor de mercado">
              <MoneyInput
                value={formData.paymentSwapMarketValue ?? ""}
                onChange={(v) => set("paymentSwapMarketValue", v)}
              />
            </Field>
          </div>
        </div>
      );
      break;
    case "cpa":
      extra = (
        <div className="pd">
          <div className="pscene">
            <div className="cpa">
              <div className="cb">Comprar agora</div>
              <span className="rp" />
              <svg className="cur" viewBox="0 0 24 24">
                <path d="M5 3l14 7-6 2-2 6z" fill="#050505" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="pfields">
            <Field label="Quais ações geram CPA?">
              <textarea
                className="ni ta"
                rows={3}
                placeholder="Ex.: clique no link, compra realizada, cadastro"
                value={formData.paymentCpaActions ?? ""}
                onChange={(e) => set("paymentCpaActions", e.target.value)}
              />
            </Field>
            <Field label="Valor por ação">
              <MoneyInput value={formData.paymentCpaValue ?? ""} onChange={(v) => set("paymentCpaValue", v)} />
            </Field>
          </div>
        </div>
      );
      break;
    case "cpm":
      extra = (
        <div className="pd">
          <div className="pscene">
            <div className="cpm">
              <span className="rg r1" />
              <span className="rg r2" />
              <span className="rg r3" />
              <div className="pl">
                <svg viewBox="0 0 24 24">
                  <path d="M9 6.8v10.4L17.6 12z" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="vw">
                <b />
              </div>
            </div>
          </div>
          <div className="pfields">
            <Field label="Valor por mil visualizações" hint="As visualizações contam por 7 dias após a publicação">
              <MoneyInput value={formData.paymentCpmValue ?? ""} onChange={(v) => set("paymentCpmValue", v)} />
            </Field>
          </div>
        </div>
      );
      break;
    case "individual_price":
      extra = (
        <div className="pd one">
          <div className="pfields">
            <p className="ncap">
              O valor será negociado individualmente com cada criador no convite. O saldo só é reservado quando o
              valor é fechado.
            </p>
          </div>
        </div>
      );
      break;
    case "price":
      extra = (
        <div className="pd one">
          <div className="pfields">
            <p className="ncap">Cada criador informa o próprio valor ao se candidatar à campanha.</p>
          </div>
        </div>
      );
      break;
  }

  const T: Array<[SecKey, string, string, string, boolean]> = [
    ["bonus", "star", "Bônus por performance", bonusOn ? "Ativo" : "Opcional", bonusOn],
    [
      "benefits",
      "sparkles",
      "Benefícios",
      benefits.length ? `${benefits.length} ${benefits.length > 1 ? "itens" : "item"}` : "Opcional",
      benefits.length > 0,
    ],
    [
      "products",
      "box",
      "Produtos enviados",
      products.length ? `${products.length} ${products.length > 1 ? "produtos" : "produto"}` : "Opcional",
      products.length > 0,
    ],
  ];

  const body: Record<SecKey, React.ReactNode> = {
    bonus: (
      <div className="nbox">
        <ToggleRow
          on={bonusOn}
          onChange={toggleBonus}
          label="Incluir bônus por performance"
          sub="Ofereça vantagens além do cachê"
        />
        {bonusOn ? (
          <Field label="Descrição do bônus">
            <textarea
              className="ni ta"
              rows={2}
              placeholder="Regras ou condições para o bônus"
              value={formData.benefitsBonus ?? ""}
              onChange={(e) => set("benefitsBonus", e.target.value)}
            />
          </Field>
        ) : null}
      </div>
    ),
    benefits: (
      <ListBox
        title="Benefícios"
        sub="O que o criador recebe além do pagamento"
        placeholder="Ex.: kit exclusivo enviado sem custo"
        items={benefits}
        onChange={setBenefits}
        icon="star"
      />
    ),
    products: (
      <SectionCard
        icon={<I n="box" cls="sm" />}
        title="Produtos enviados"
        sub="Opcional. Cadastre o que será enviado aos criadores, principalmente em permutas"
        className="n4p pdp"
        right={
          products.length ? (
            <span className="pdn">
              {products.length} {products.length > 1 ? "produtos" : "produto"}
            </span>
          ) : undefined
        }
      >
        {products.length ? (
          products.map((p, i) => (
            <div key={p.id} className="pdc">
              <div className="pdh">
                <span className="pn">{i + 1}</span>
                <b>Produto {i + 1}</b>
                <button
                  type="button"
                  className="pdx"
                  aria-label="Remover produto"
                  onClick={() => setProducts(products.filter((x) => x.id !== p.id))}
                >
                  <I n="trash" cls="sm" />
                </button>
              </div>
              <div className="pdg">
                <div className="n4c">
                  <label className="n4l">Nome</label>
                  <input
                    className="ni"
                    placeholder="Ex.: Kit de skincare"
                    autoComplete="off"
                    value={p.name}
                    onChange={(e) => patchProduct(p.id, { name: e.target.value })}
                  />
                </div>
                <div className="n4c">
                  <label className="n4l">Marca</label>
                  <input
                    className="ni"
                    placeholder="Ex.: Casa Lume"
                    autoComplete="off"
                    value={p.brand ?? ""}
                    onChange={(e) => patchProduct(p.id, { brand: e.target.value })}
                  />
                </div>
                <div className="n4c">
                  <label className="n4l">Valor de mercado</label>
                  <MoneyInput
                    value={p.market_value ?? ""}
                    onChange={(v) => patchProduct(p.id, { market_value: v })}
                  />
                </div>
                <div className="n4c">
                  <label className="n4l">SKU</label>
                  <input
                    className="ni"
                    placeholder="Ex.: SKU-001"
                    autoComplete="off"
                    value={p.sku ?? ""}
                    onChange={(e) => patchProduct(p.id, { sku: e.target.value })}
                  />
                </div>
                <div className="n4c full">
                  <label className="n4l">Observações</label>
                  <input
                    className="ni"
                    placeholder="Informações para o influenciador"
                    autoComplete="off"
                    value={p.notes ?? ""}
                    onChange={(e) => patchProduct(p.id, { notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="pde">
            <span>
              <I n="box" />
            </span>
            <b>Nenhum produto cadastrado</b>
            <small>Você pode pular se a campanha não envia produtos.</small>
          </div>
        )}
        <button type="button" className="pda" onClick={() => setProducts([...products, emptyProduct()])}>
          <I n="plus" cls="sm" />
          Adicionar produto
        </button>
        {formData.paymentType !== "swap" ? (
          <small className="nfh">Os produtos só são salvos na campanha quando a modalidade é Permuta.</small>
        ) : null}
      </SectionCard>
    ),
  };

  return (
    <div className="n2flow">
      <SectionCard
        icon={<I n="wallet" cls="sm" />}
        title="Como os criadores serão pagos"
        sub="Escolha uma modalidade"
        className={`${tried && !formData.paymentType ? "err " : ""}wide`}
      >
        <div className="npo">
          {PAYS.map(([k, l, sub]) => (
            <button
              key={k}
              type="button"
              className={`pco ${formData.paymentType === k ? "on" : ""}`}
              aria-pressed={formData.paymentType === k}
              onClick={() => set("paymentType", k)}
            >
              <span className="pi">
                <I n={PICON[k]} cls="sm" />
              </span>
              <b>{l}</b>
              <small>{sub}</small>
            </button>
          ))}
        </div>
        <FieldError show={tried && !formData.paymentType}>Escolha como os criadores serão pagos</FieldError>
      </SectionCard>

      {pay && extra ? (
        <SectionCard
          key={pay[0]}
          icon={<I n={PICON[pay[0]]} cls="sm" />}
          title={PSHORT[pay[0]]}
          sub={pay[2]}
          className="pdet rev"
        >
          {extra}
        </SectionCard>
      ) : null}

      {pay ? (
        <>
          <div className="n3row rev">
            {T.map(([k, ico, t, sub, on]) => (
              <button
                key={k}
                type="button"
                className={`n3t ${sec === k ? "open" : ""} ${on ? "filled" : ""}`}
                aria-expanded={sec === k}
                onClick={() => setSec(sec === k ? null : k)}
              >
                <span className="n3i">
                  <I n={ico} cls="sm" />
                </span>
                <b>{t}</b>
                <small>{sub}</small>
                <i className="n3p-i">
                  <I n="plus" cls="sm" />
                </i>
              </button>
            ))}
          </div>
          {T.map(([k]) => (
            <div key={k} className={`n3p ${sec === k ? "open" : ""}`}>
              <div className="n3pi">{body[k]}</div>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

function maskInline(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
