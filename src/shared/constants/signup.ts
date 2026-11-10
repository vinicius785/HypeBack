/**
 * Cadastro de novas contas e de novas marcas/workspaces: desligado por enquanto. Com `false`, a rota `/sign-up` e a
 * criação de workspace (`/onboarding/create-workspace`) redirecionam, e os botões "Criar conta", "Novo workspace" e
 * "Criar marca" ficam ocultos. Quem já tem conta entra normalmente. Para reabrir o cadastro, troque para `true`.
 * (Isto só esconde na plataforma: a API continua aceitando a criação.)
 */
export const SIGNUP_ENABLED = false;
