// Companhias aéreas pelo prefixo do indicativo

// Companhia pelo prefixo ICAO do indicativo (GLO1234 → GLO)
export const prefixo = av => /^[A-Z]{3}\d/.test(av.indicativo) ? av.indicativo.slice(0, 3) : null;
const COMPANHIAS = {
  GLO: 'Gol', TAM: 'LATAM Brasil', AZU: 'Azul', PTB: 'Voepass', TTL: 'Total', MWM: 'Modern Logistics', SID: 'Sideral',
  LAN: 'LATAM Chile', LPE: 'LATAM Peru', ARG: 'Aerolíneas Argentinas', AVA: 'Avianca', CMP: 'Copa', JAT: 'JetSMART',
  SKU: 'Sky Airline', BOV: 'Boliviana', AAL: 'American', UAL: 'United', DAL: 'Delta', ACA: 'Air Canada', AMX: 'Aeroméxico',
  AFR: 'Air France', KLM: 'KLM', DLH: 'Lufthansa', BAW: 'British Airways', IBE: 'Iberia', TAP: 'TAP', AEA: 'Air Europa',
  ITY: 'ITA Airways', SWR: 'Swiss', UAE: 'Emirates', QTR: 'Qatar Airways', ETH: 'Ethiopian', THY: 'Turkish Airlines',
  SAA: 'South African', RAM: 'Royal Air Maroc', FDX: 'FedEx', UPS: 'UPS', GTI: 'Atlas Air', CLX: 'Cargolux',
  FAB: 'Força Aérea Brasileira',
};
export const nomesCompanhia = new Map();  // prefixo → nome vindo do adsbdb, para os que não estão na tabela
export const nomeCompanhia = pre => COMPANHIAS[pre] || nomesCompanhia.get(pre) || pre;
