import type { AccountType } from "@/shared/services/account-type-requests";

/** O que cada tipo de conta é e no que muda a operação (só o que existe hoje no produto). */
export const ACCOUNT_TYPE_INFO: Record<AccountType, { description: string; points: string[] }> = {
  brand: {
    description: "Empresa que usa o HypeApp para gerenciar as próprias campanhas e ações de marketing de influência.",
    points: ["As campanhas são da própria empresa.", "Um único cadastro de marca, com logo, nicho e dados da empresa.", "Criadores e listas servem às campanhas da empresa."],
  },
  agency: {
    description: "Empresa que gerencia campanhas de diferentes marcas e clientes.",
    points: ["Cadastra várias marcas dentro do workspace e vincula cada campanha a uma delas.", "Mantém um elenco próprio de criadores, convidados pela agência.", "O time pode atuar em todas as marcas ou só nas que forem atribuídas."],
  },
};
