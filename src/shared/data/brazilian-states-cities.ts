export interface City {
  name: string;
  state: string;
}

export interface State {
  code: string;
  name: string;
}

export const BRAZILIAN_STATES: State[] = [
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" },
  { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" },
];

export const BRAZILIAN_CITIES: City[] = [
  // Acre
  { name: "Rio Branco", state: "AC" },
  { name: "Cruzeiro do Sul", state: "AC" },
  { name: "Sena Madureira", state: "AC" },
  
  // Alagoas
  { name: "Maceió", state: "AL" },
  { name: "Arapiraca", state: "AL" },
  { name: "Rio Largo", state: "AL" },
  { name: "Palmeira dos Índios", state: "AL" },
  
  // Amapá
  { name: "Macapá", state: "AP" },
  { name: "Santana", state: "AP" },
  { name: "Laranjal do Jari", state: "AP" },
  
  // Amazonas
  { name: "Manaus", state: "AM" },
  { name: "Parintins", state: "AM" },
  { name: "Itacoatiara", state: "AM" },
  { name: "Manacapuru", state: "AM" },
  { name: "Coari", state: "AM" },
  
  // Bahia
  { name: "Salvador", state: "BA" },
  { name: "Feira de Santana", state: "BA" },
  { name: "Vitória da Conquista", state: "BA" },
  { name: "Camaçari", state: "BA" },
  { name: "Juazeiro", state: "BA" },
  { name: "Ilhéus", state: "BA" },
  { name: "Itabuna", state: "BA" },
  { name: "Jequié", state: "BA" },
  { name: "Alagoinhas", state: "BA" },
  { name: "Barreiras", state: "BA" },
  
  // Ceará
  { name: "Fortaleza", state: "CE" },
  { name: "Caucaia", state: "CE" },
  { name: "Juazeiro do Norte", state: "CE" },
  { name: "Maracanaú", state: "CE" },
  { name: "Sobral", state: "CE" },
  { name: "Crato", state: "CE" },
  { name: "Itapipoca", state: "CE" },
  { name: "Maranguape", state: "CE" },
  
  // Distrito Federal
  { name: "Brasília", state: "DF" },
  { name: "Ceilândia", state: "DF" },
  { name: "Taguatinga", state: "DF" },
  { name: "Samambaia", state: "DF" },
  
  // Espírito Santo
  { name: "Vitória", state: "ES" },
  { name: "Vila Velha", state: "ES" },
  { name: "Cariacica", state: "ES" },
  { name: "Serra", state: "ES" },
  { name: "Cachoeiro de Itapemirim", state: "ES" },
  
  // Goiás
  { name: "Goiânia", state: "GO" },
  { name: "Aparecida de Goiânia", state: "GO" },
  { name: "Anápolis", state: "GO" },
  { name: "Rio Verde", state: "GO" },
  { name: "Luziânia", state: "GO" },
  { name: "Águas Lindas de Goiás", state: "GO" },
  
  // Maranhão
  { name: "São Luís", state: "MA" },
  { name: "Imperatriz", state: "MA" },
  { name: "Caxias", state: "MA" },
  { name: "Timon", state: "MA" },
  { name: "Codó", state: "MA" },
  
  // Mato Grosso
  { name: "Cuiabá", state: "MT" },
  { name: "Várzea Grande", state: "MT" },
  { name: "Rondonópolis", state: "MT" },
  { name: "Sinop", state: "MT" },
  { name: "Tangará da Serra", state: "MT" },
  
  // Mato Grosso do Sul
  { name: "Campo Grande", state: "MS" },
  { name: "Dourados", state: "MS" },
  { name: "Três Lagoas", state: "MS" },
  { name: "Corumbá", state: "MS" },
  { name: "Ponta Porã", state: "MS" },
  
  // Minas Gerais
  { name: "Belo Horizonte", state: "MG" },
  { name: "Uberlândia", state: "MG" },
  { name: "Contagem", state: "MG" },
  { name: "Juiz de Fora", state: "MG" },
  { name: "Betim", state: "MG" },
  { name: "Montes Claros", state: "MG" },
  { name: "Ribeirão das Neves", state: "MG" },
  { name: "Uberaba", state: "MG" },
  { name: "Governador Valadares", state: "MG" },
  { name: "Ipatinga", state: "MG" },
  { name: "Sete Lagoas", state: "MG" },
  { name: "Divinópolis", state: "MG" },
  { name: "Santa Luzia", state: "MG" },
  { name: "Poços de Caldas", state: "MG" },
  { name: "Patos de Minas", state: "MG" },
  
  // Pará
  { name: "Belém", state: "PA" },
  { name: "Ananindeua", state: "PA" },
  { name: "Marituba", state: "PA" },
  { name: "Paragominas", state: "PA" },
  { name: "Castanhal", state: "PA" },
  { name: "Abaetetuba", state: "PA" },
  
  // Paraíba
  { name: "João Pessoa", state: "PB" },
  { name: "Campina Grande", state: "PB" },
  { name: "Santa Rita", state: "PB" },
  { name: "Patos", state: "PB" },
  { name: "Bayeux", state: "PB" },
  
  // Paraná
  { name: "Curitiba", state: "PR" },
  { name: "Londrina", state: "PR" },
  { name: "Maringá", state: "PR" },
  { name: "Ponta Grossa", state: "PR" },
  { name: "Cascavel", state: "PR" },
  { name: "São José dos Pinhais", state: "PR" },
  { name: "Foz do Iguaçu", state: "PR" },
  { name: "Colombo", state: "PR" },
  { name: "Guarapuava", state: "PR" },
  { name: "Paranaguá", state: "PR" },
  
  // Pernambuco
  { name: "Recife", state: "PE" },
  { name: "Jaboatão dos Guararapes", state: "PE" },
  { name: "Olinda", state: "PE" },
  { name: "Caruaru", state: "PE" },
  { name: "Petrolina", state: "PE" },
  { name: "Paulista", state: "PE" },
  { name: "Cabo de Santo Agostinho", state: "PE" },
  { name: "Camaragibe", state: "PE" },
  
  // Piauí
  { name: "Teresina", state: "PI" },
  { name: "Parnaíba", state: "PI" },
  { name: "Picos", state: "PI" },
  { name: "Piripiri", state: "PI" },
  { name: "Campo Maior", state: "PI" },
  
  // Rio de Janeiro
  { name: "Rio de Janeiro", state: "RJ" },
  { name: "São Gonçalo", state: "RJ" },
  { name: "Duque de Caxias", state: "RJ" },
  { name: "Nova Iguaçu", state: "RJ" },
  { name: "Niterói", state: "RJ" },
  { name: "Campos dos Goytacazes", state: "RJ" },
  { name: "Belford Roxo", state: "RJ" },
  { name: "São João de Meriti", state: "RJ" },
  { name: "Petrópolis", state: "RJ" },
  { name: "Volta Redonda", state: "RJ" },
  { name: "Magé", state: "RJ" },
  { name: "Macaé", state: "RJ" },
  
  // Rio Grande do Norte
  { name: "Natal", state: "RN" },
  { name: "Mossoró", state: "RN" },
  { name: "Parnamirim", state: "RN" },
  { name: "São Gonçalo do Amarante", state: "RN" },
  { name: "Macaíba", state: "RN" },
  
  // Rio Grande do Sul
  { name: "Porto Alegre", state: "RS" },
  { name: "Caxias do Sul", state: "RS" },
  { name: "Pelotas", state: "RS" },
  { name: "Canoas", state: "RS" },
  { name: "Santa Maria", state: "RS" },
  { name: "Gravataí", state: "RS" },
  { name: "Viamão", state: "RS" },
  { name: "Novo Hamburgo", state: "RS" },
  { name: "São Leopoldo", state: "RS" },
  { name: "Rio Grande", state: "RS" },
  { name: "Alvorada", state: "RS" },
  { name: "Passo Fundo", state: "RS" },
  
  // Rondônia
  { name: "Porto Velho", state: "RO" },
  { name: "Ji-Paraná", state: "RO" },
  { name: "Ariquemes", state: "RO" },
  { name: "Vilhena", state: "RO" },
  { name: "Cacoal", state: "RO" },
  
  // Roraima
  { name: "Boa Vista", state: "RR" },
  { name: "Rorainópolis", state: "RR" },
  { name: "Caracaraí", state: "RR" },
  
  // Santa Catarina
  { name: "Florianópolis", state: "SC" },
  { name: "Joinville", state: "SC" },
  { name: "Blumenau", state: "SC" },
  { name: "São José", state: "SC" },
  { name: "Criciúma", state: "SC" },
  { name: "Chapecó", state: "SC" },
  { name: "Itajaí", state: "SC" },
  { name: "Lages", state: "SC" },
  { name: "Jaraguá do Sul", state: "SC" },
  { name: "Palhoça", state: "SC" },
  { name: "Brusque", state: "SC" },
  { name: "Balneário Camboriú", state: "SC" },
  
  // São Paulo
  { name: "São Paulo", state: "SP" },
  { name: "Guarulhos", state: "SP" },
  { name: "Campinas", state: "SP" },
  { name: "São Bernardo do Campo", state: "SP" },
  { name: "Santo André", state: "SP" },
  { name: "Osasco", state: "SP" },
  { name: "Ribeirão Preto", state: "SP" },
  { name: "Sorocaba", state: "SP" },
  { name: "Santos", state: "SP" },
  { name: "Mauá", state: "SP" },
  { name: "São José dos Campos", state: "SP" },
  { name: "Mogi das Cruzes", state: "SP" },
  { name: "Diadema", state: "SP" },
  { name: "Jundiaí", state: "SP" },
  { name: "Carapicuíba", state: "SP" },
  { name: "Piracicaba", state: "SP" },
  { name: "Bauru", state: "SP" },
  { name: "São Vicente", state: "SP" },
  { name: "Itaquaquecetuba", state: "SP" },
  { name: "Franca", state: "SP" },
  { name: "Praia Grande", state: "SP" },
  { name: "Guarujá", state: "SP" },
  { name: "Taubaté", state: "SP" },
  { name: "Barueri", state: "SP" },
  { name: "Embu das Artes", state: "SP" },
  { name: "Americana", state: "SP" },
  { name: "Araraquara", state: "SP" },
  { name: "São Caetano do Sul", state: "SP" },
  { name: "Jacareí", state: "SP" },
  { name: "Hortolândia", state: "SP" },
  
  // Sergipe
  { name: "Aracaju", state: "SE" },
  { name: "Nossa Senhora do Socorro", state: "SE" },
  { name: "Lagarto", state: "SE" },
  { name: "Itabaiana", state: "SE" },
  { name: "São Cristóvão", state: "SE" },
  
  // Tocantins
  { name: "Palmas", state: "TO" },
  { name: "Araguaína", state: "TO" },
  { name: "Gurupi", state: "TO" },
  { name: "Porto Nacional", state: "TO" },
  { name: "Paraíso do Tocantins", state: "TO" },
];

export const getCitiesByState = (stateCode: string): City[] => {
  return BRAZILIAN_CITIES.filter((city) => city.state === stateCode);
};

export const getAllCities = (): City[] => {
  return BRAZILIAN_CITIES;
};

export const getAllStates = (): State[] => {
  return BRAZILIAN_STATES;
};

// ---------------------------------------------------------------------------
// Chave de cidade usada nos selects: "Nome-UF" (ex.: "Biritiba-Mirim-SP").
// O nome pode conter hífen, então a UF é sempre o trecho após o ÚLTIMO hífen —
// `split("-")[0]` quebraria nessas cidades.
// ---------------------------------------------------------------------------

export const buildCityKey = (name: string, state: string): string =>
  `${name}-${state}`;

export const parseCityKey = (
  key: string,
): { name: string; state: string } | null => {
  const separator = key.lastIndexOf("-");
  if (separator <= 0 || separator === key.length - 1) return null;
  return {
    name: key.slice(0, separator),
    state: key.slice(separator + 1),
  };
};

/**
 * Mantém apenas as cidades que ainda pertencem aos estados selecionados.
 *
 * Trocar a lista de estados não pode zerar a seleção de cidades: ao adicionar um
 * segundo estado, as cidades já escolhidas no primeiro continuam válidas. Só
 * saem as cidades de um estado que foi removido (e chaves malformadas).
 */
export const retainCitiesForStates = (
  cityKeys: string[],
  stateCodes: string[],
): string[] => {
  if (stateCodes.length === 0) return [];
  const allowed = new Set(stateCodes);
  return cityKeys.filter((key) => {
    const parsed = parseCityKey(key);
    return !!parsed && allowed.has(parsed.state);
  });
};
