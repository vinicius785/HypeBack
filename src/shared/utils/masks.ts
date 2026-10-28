/**
 * Formata um número removendo caracteres não numéricos
 */
export const formatNumber = (value: string): string => {
  return value.replace(/\D/g, "");
};

/**
 * Formata um número com separador de milhar
 */
export const formatNumberWithSeparator = (value: string): string => {
  const numbers = formatNumber(value);
  if (!numbers) return "";
  
  return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

/**
 * Aplica máscara de número com separador de milhar em um input
 * Previne números negativos
 */
export const handleNumberInput = (
  e: React.ChangeEvent<HTMLInputElement>,
  callback: (value: string) => void
): void => {
  // Remove caracteres não numéricos e o sinal de menos
  const cleaned = e.target.value.replace(/[^\d]/g, "");
  
  // Se o valor estiver vazio, permite (para poder limpar o campo)
  if (cleaned === "") {
    callback("");
    return;
  }
  
  // Formata com separador de milhar
  const formatted = formatNumberWithSeparator(cleaned);
  callback(formatted);
};

/**
 * Valida e previne números negativos em inputs do tipo number
 */
export const handleNumberInputMinZero = (
  e: React.ChangeEvent<HTMLInputElement>,
  callback: (value: string) => void
): void => {
  const value = e.target.value;
  
  // Se estiver vazio, permite (para poder limpar o campo)
  if (value === "" || value === "-") {
    callback("");
    return;
  }
  
  // Converte para número e verifica se é negativo
  const numValue = parseFloat(value);
  
  // Se for negativo ou NaN, não atualiza
  if (isNaN(numValue) || numValue < 0) {
    // Se o usuário está tentando digitar um número negativo, ignora
    return;
  }
  
  callback(value);
};

/**
 * Remove a formatação e retorna apenas números
 */
export const unformatNumber = (value: string): string => {
  return formatNumber(value);
};

/**
 * Formata um valor monetário no padrão brasileiro (1.234,56)
 * Recebe apenas números (string) e formata como moeda
 */
export const formatCurrency = (value: string): string => {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "";
  
  // Converte para número inteiro (em centavos)
  const numValue = parseInt(numbers, 10);
  if (isNaN(numValue)) return "";
  
  // Converte centavos para reais
  const reais = numValue / 100;
  
  // Formata com 2 casas decimais, separador de milhar (.) e decimal (,)
  return reais.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Remove a formatação monetária e retorna apenas números (em centavos)
 */
export const unformatCurrency = (value: string): string => {
  // Remove tudo que não é número
  return value.replace(/\D/g, "");
};

/**
 * Formata um número decimal (reais, ex: 1234.56) para o padrão brasileiro (1.234,56)
 * Diferente de formatCurrency que assume centavos — esta recebe reais diretamente.
 * Útil para exibir valores vindos da API.
 */
export const formatReais = (value: number | string): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Converte um valor monetário formatado no padrão brasileiro (1.234,56) para número decimal (1234.56)
 * Útil para enviar valores monetários à API que espera números decimais
 */
export const currencyToNumber = (value: string): number => {
  if (!value) return 0;
  
  // Remove pontos (separadores de milhar) e substitui vírgula por ponto (separador decimal)
  const normalized = value.replace(/\./g, "").replace(",", ".");
  
  const numValue = parseFloat(normalized);
  return isNaN(numValue) ? 0 : numValue;
};

/**
 * Aplica máscara de valor monetário brasileiro em um input
 * Formato: R$ 1.234,56
 * O valor é armazenado formatado (1.234,56) mas pode ser convertido para centavos com unformatCurrency
 */
export const handleCurrencyInput = (
  e: React.ChangeEvent<HTMLInputElement>,
  callback: (value: string) => void
): void => {
  // Remove R$, espaços e mantém apenas números
  const cleaned = e.target.value.replace(/\D/g, "");
  
  // Se o valor estiver vazio, permite (para poder limpar o campo)
  if (cleaned === "") {
    callback("");
    return;
  }
  
  // Formata como moeda brasileira (sem o R$)
  const formatted = formatCurrency(cleaned);
  // Armazena o valor formatado (1.234,56) para exibição
  callback(formatted);
};

/**
 * Máscara de telefone/celular BR: (XX) XXXX-XXXX (10 dígitos) ou (XX) XXXXX-XXXX (11).
 */
export const formatBrazilianPhoneInput = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  const ddd = digits.slice(0, 2);
  if (digits.length <= 2) return `(${ddd}`;
  const rest = digits.slice(2);
  if (digits.length <= 6) return `(${ddd}) ${rest}`;
  if (digits.length <= 10) {
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
};

/**
 * Máscara de CPF: 000.000.000-00 (até 14 chars com máscara, 11 dígitos).
 * Aplica progressivamente conforme o usuário digita — o input mostra o valor formatado.
 */
export const formatCpfInput = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

/**
 * Máscara de CNPJ: 00.000.000/0000-00 (até 18 chars com máscara, 14 dígitos).
 */
export const formatCnpjInput = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

/**
 * Máscara de CEP: 00000-000 (até 9 chars com máscara, 8 dígitos).
 */
export const formatCepInput = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

/** Conta apenas dígitos — útil para validar comprimento de CPF/CNPJ. */
export const digitCount = (value: string): number =>
  value.replace(/\D/g, "").length;

