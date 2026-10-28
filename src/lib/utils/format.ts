export function formatPhoneNumber(phoneValue: string): string {
  const numbers = phoneValue.replace(/\D/g, "").slice(0, 11);

  if (numbers.length <= 10) {
    return numbers.replace(
      /(\d{2})(\d{4})(\d{0,4})/,
      (_, area, first, second) => {
        if (second) return `(${area}) ${first}-${second}`;
        if (first) return `(${area}) ${first}`;
        if (area) return `(${area}`;
        return numbers;
      }
    );
  } else {
    return numbers.replace(
      /(\d{2})(\d{5})(\d{0,4})/,
      (_, area, first, second) => {
        if (second) return `(${area}) ${first}-${second}`;
        if (first) return `(${area}) ${first}`;
        if (area) return `(${area}`;
        return numbers;
      }
    );
  }
}

export const cleanPhoneNumber = (phoneValue: string): string => {
  return phoneValue.replace(/\D/g, "");
};

export const truncateText = (text: string, maxLength: number = 20): string => {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
};
