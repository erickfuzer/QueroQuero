// Utilitários de DOM, números, distância e armazenamento local

export const $ = id => document.getElementById(id);
export const num = (n, casas = 0) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });
export const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
export const RAD = Math.PI / 180;
export const SVG_NS = 'http://www.w3.org/2000/svg';

// localStorage pode não existir (aba anônima, bloqueio); nada aqui é essencial
export const guardado = {
  ler(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } },
  gravar(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) { /* sem persistência */ } },
};

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * RAD, dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

const PONTOS_CARDEAIS = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
export const cardeal = graus => PONTOS_CARDEAIS[Math.round(((graus % 360) + 360) % 360 / 22.5) % 16];

export function coordenada(valor, positivo, negativo) {
  return `${num(Math.abs(valor), 3)}° ${valor >= 0 ? positivo : negativo}`;
}

export function texto(id, valor) { $(id).textContent = valor; }
export const horaUtc = t => new Date(t).toISOString().slice(11, 16) + 'Z';
