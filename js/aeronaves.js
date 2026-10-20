// Silhuetas, grupos e classificação das aeronaves
import { SVG_NS } from './util.js';

// Silhuetas vistas de cima, apontando para o norte, num quadro de -16 a 16.
// O mesmo traçado vira Path2D no mapa e <path> nos ícones da interface.
// Cada silhueta é geométrica (retas nas asas, curvas suaves no nariz, naceles e cauda) e segue
// as medidas publicadas do modelo de referência: comprimento, envergadura, largura da fuselagem,
// posição da asa, dos motores e da empenagem. O Gripen foi traçado sobre foto de cima da Saab.
// Todas formam um contorno único, sem naceles sobrepostas.
export const FORMAS = {
  comercial: {  // A320
    nome: 'Jato comercial', escala: 0.85,
    d: 'M-4.97 -6.73L-5.19 -6.65L-5.37 -6.52L-5.51 -6.35L-5.6 -6.16L-5.63 -5.96L-5.63 -4.1L-5.32 -2.96L-4.88 -2.96L-14.52 2.32L-14.77 2.57L-14.77 3.64L-5.12 0.51L-1.63 0.35L-1.63 5.16L-1.58 6.51L-1.52 7.41L-1.38 8.76L-1.06 10.95L-5.13 13.3L-5.13 14.45L-0.42 14.53L-0.26 15.5L0.26 15.5L0.42 14.53L5.13 14.45L5.13 13.3L1.06 10.95L1.38 8.76L1.52 7.41L1.58 6.51L1.63 5.16L1.63 0.35L5.12 0.51L14.77 3.64L14.77 2.57L14.52 2.32L4.88 -2.96L5.32 -2.96L5.63 -4.1L5.62 -6.06L5.56 -6.26L5.45 -6.44L5.19 -6.65L4.97 -6.73L4.74 -6.75L4.41 -6.69L4.2 -6.59L4.04 -6.44L3.89 -6.16L3.86 -5.96L3.86 -4.1L4.04 -3.42L1.63 -4.74L1.63 -11.21L1.57 -12.28L1.43 -13.18L1.3 -13.71L1.18 -14.07L1.03 -14.43L0.85 -14.78L0.59 -15.14L0.41 -15.32L0 -15.5L-0.41 -15.32L-0.59 -15.14L-0.85 -14.78L-1.11 -14.25L-1.3 -13.71L-1.47 -13L-1.57 -12.28L-1.63 -11.39L-1.63 -4.74L-4.04 -3.42L-3.86 -4.1L-3.86 -5.96L-3.89 -6.16L-4.04 -6.44L-4.3 -6.65L-4.63 -6.75Z',
  },
  pesado: {  // 777-300ER
    nome: 'Grande porte', escala: 0.95,
    d: 'M-4.28 -6.08L-4.57 -5.95L-4.72 -5.82L-4.82 -5.65L-4.88 -5.46L-4.89 -3.64L-4.6 -2.58L-4.57 -2.58L-11.96 2.37L-13.59 4.47L-13.38 4.8L-4.82 0.69L-1.3 0.61L-1.29 7.08L-1.21 8.61L-0.99 10.57L-4.49 13.11L-4.49 14.03L-0.41 14.11L-0.19 15.5L0.19 15.5L0.41 14.11L4.49 14.03L4.49 13.11L0.99 10.57L1.21 8.61L1.29 7.08L1.3 0.61L4.82 0.69L13.38 4.8L13.59 4.47L11.96 2.37L4.57 -2.58L4.6 -2.58L4.89 -3.64L4.89 -5.37L4.86 -5.56L4.78 -5.74L4.57 -5.95L4.28 -6.08L4.07 -6.1L3.86 -6.08L3.57 -5.95L3.42 -5.82L3.31 -5.65L3.25 -5.37L3.25 -3.64L3.31 -3.43L1.3 -4.77L1.3 -11.68L1.27 -12.35L1.22 -12.84L1.14 -13.34L1.03 -13.84L0.89 -14.34L0.76 -14.67L0.59 -15L0.33 -15.33L0 -15.5L-0.33 -15.33L-0.59 -15L-0.76 -14.67L-0.89 -14.34L-1.03 -13.84L-1.14 -13.34L-1.22 -12.84L-1.27 -12.35L-1.3 -11.68L-1.3 -4.77L-3.31 -3.43L-3.25 -3.64L-3.25 -5.37L-3.28 -5.56L-3.42 -5.82L-3.66 -6L-3.96 -6.1Z',
  },
  jumbo: {  // 747-400
    nome: 'Quadrimotor de grande porte', escala: 1,
    d: 'M-5.42 -3.95L-5.56 -3.88L-5.67 -3.78L-5.75 -3.65L-5.79 -3.51L-5.8 -1.97L-5.7 -1.57L-8.67 0.92L-8.68 -0.11L-8.72 -0.24L-8.79 -0.36L-8.9 -0.46L-9.04 -0.53L-9.26 -0.57L-9.49 -0.53L-9.68 -0.41L-9.81 -0.24L-9.86 -0.04L-9.86 1.4L-9.75 1.82L-14.14 5.49L-14.23 5.84L-14.14 7.16L-4.74 1.45L-1.43 1.02L-1.43 5.58L-1.4 6.82L-1.28 8.47L-1.02 10.53L-4.87 13.3L-4.87 14.36L-0.31 14.62L-0.18 15.5L0.18 15.5L0.31 14.62L4.87 14.36L4.87 13.3L1.02 10.53L1.28 8.47L1.4 6.82L1.43 5.58L1.43 1.02L4.74 1.45L14.14 7.16L14.23 5.84L14.14 5.49L9.75 1.82L9.86 1.4L9.86 -0.04L9.81 -0.24L9.68 -0.41L9.49 -0.53L9.26 -0.57L9.04 -0.53L8.9 -0.46L8.79 -0.36L8.72 -0.24L8.68 -0.11L8.67 0.92L5.7 -1.57L5.8 -1.97L5.8 -3.44L5.75 -3.65L5.62 -3.83L5.42 -3.95L5.18 -4L5.02 -3.98L4.87 -3.92L4.69 -3.78L4.61 -3.65L4.57 -3.51L4.57 -2.51L1.43 -5.13L1.43 -11.5L1.37 -12.55L1.24 -13.41L1.01 -14.28L0.87 -14.63L0.69 -14.98L0.57 -15.15L0.41 -15.33L0 -15.5L-0.41 -15.33L-0.57 -15.15L-0.79 -14.8L-0.94 -14.46L-1.11 -13.94L-1.27 -13.24L-1.38 -12.37L-1.43 -11.5L-1.43 -5.13L-4.57 -2.51L-4.57 -3.44L-4.59 -3.59L-4.65 -3.72L-4.81 -3.88L-5.02 -3.98L-5.18 -4Z',
  },
  cargueiro: {  // KC-390
    nome: 'Transporte militar', escala: 0.9,
    d: 'M-5.1 -9.13L-5.22 -9.09L-5.45 -8.97L-5.63 -8.81L-5.76 -8.61L-5.83 -8.38L-5.83 -5.83L-5.72 -5.38L-15.41 0L-15.5 0.35L-15.5 1.41L-2.82 -1.2L-2.86 -1.06L-2.64 0.88L-2.08 2.11L-2.07 5.2L-2.04 6.1L-1.97 6.99L-1.86 7.89L-1.65 9.23L-1.47 10.13L-1.19 11.37L-4.93 13.91L-5.06 14.09L-5.06 14.93L-0.54 13.81L-0.09 15.5L0.09 15.5L0.54 13.81L5.06 14.93L5.06 14.09L4.93 13.91L1.19 11.37L1.47 10.13L1.65 9.23L1.86 7.89L1.97 6.99L2.04 6.1L2.07 5.2L2.08 2.11L2.64 0.88L2.86 -1.06L2.82 -1.2L15.5 1.41L15.5 0.35L15.41 0L5.72 -5.38L5.83 -5.83L5.83 -8.38L5.76 -8.61L5.7 -8.71L5.54 -8.9L5.34 -9.04L5.1 -9.13L4.97 -9.15L4.84 -9.16L4.59 -9.13L4.46 -9.09L4.24 -8.97L4.14 -8.9L3.99 -8.71L3.89 -8.5L3.85 -8.27L3.85 -6.41L2.08 -7.4L2.08 -9.09L2.03 -9.92L1.9 -11.04L1.68 -12.15L1.34 -13.27L1.12 -13.83L0.85 -14.38L0.53 -14.94L0.32 -15.22L0 -15.5L-0.32 -15.22L-0.53 -14.94L-0.85 -14.38L-1.12 -13.83L-1.34 -13.27L-1.68 -12.15L-1.9 -11.04L-2.03 -9.92L-2.08 -9.09L-2.08 -7.4L-3.85 -6.41L-3.85 -8.27L-3.89 -8.5L-3.93 -8.61L-3.99 -8.71L-4.14 -8.9L-4.24 -8.97L-4.46 -9.09L-4.59 -9.13L-4.84 -9.16Z',
  },
  caca: {  // F-39 Gripen F, traçado sobre foto de cima da Saab
    nome: 'Caça', escala: 0.85,
    d: 'M-0.28 -14.74L-0.49 -13.84L-0.69 -12.45L-0.94 -8.63L-0.97 -6.69L-4.65 -1.63L-4.65 -0.45L-2.15 -1.42L-1.46 -1.21L-1.46 -0.45L-8.18 5.93L-8.18 3.71L-8.67 3.71L-8.67 10.92L-8.18 10.92L-8.18 9.05L-4.85 9.54L-1.73 10.16L-1.46 11.48L-1.25 12.17L-0.69 14.81L-0.49 15.29L-0.24 15.5L0.24 15.5L0.49 15.29L0.69 14.81L1.25 12.17L1.46 11.48L1.73 10.16L4.85 9.54L8.18 9.05L8.18 10.92L8.67 10.92L8.67 3.71L8.18 3.71L8.18 5.93L1.46 -0.45L1.46 -1.21L2.15 -1.42L4.65 -0.45L4.65 -1.63L0.97 -6.69L0.94 -8.63L0.69 -12.45L0.49 -13.84L0.28 -14.74L0 -15.5Z',
  },
  turboelice: {  // ATR 72-600
    nome: 'Regional turboélice', escala: 0.85,
    d: 'M-5.21 -6.03L-5.31 -5.88L-5.36 -5.64L-5.36 -3.28L-15.4 -2.95L-15.44 -1.35L-5.34 -0.69L-5.02 1.5L-4.34 1.5L-4.03 -0.6L-1.64 -0.44L-1.63 4.38L-1.56 6.31L-1.49 7.28L-1.35 8.73L-1.16 10.18L-0.89 12L-4.16 12.68L-4.16 13.94L-0.56 14.04L-0.34 15.5L0.34 15.5L0.56 14.04L4.16 13.94L4.16 12.68L0.89 12L1.16 10.18L1.35 8.73L1.49 7.28L1.56 6.31L1.63 4.38L1.64 -0.44L4.03 -0.6L4.34 1.5L5.02 1.5L5.34 -0.69L15.44 -1.35L15.4 -2.95L5.36 -3.28L5.36 -5.64L5.31 -5.88L5.21 -6.03L6.9 -6.03L6.9 -6.43L2.45 -6.43L2.45 -6.03L4.15 -6.03L4.05 -5.88L3.99 -5.64L3.99 -3.33L1.64 -3.4L1.64 -11.39L1.61 -12.08L1.55 -12.59L1.42 -13.28L1.28 -13.79L1.08 -14.3L0.91 -14.64L0.69 -14.99L0.36 -15.33L0 -15.5L-0.36 -15.33L-0.69 -14.99L-0.91 -14.64L-1.08 -14.3L-1.28 -13.79L-1.42 -13.28L-1.55 -12.59L-1.61 -12.08L-1.64 -11.39L-1.64 -3.4L-3.99 -3.33L-3.99 -5.64L-4.05 -5.88L-4.15 -6.03L-2.45 -6.03L-2.45 -6.43L-6.9 -6.43L-6.9 -6.03Z',
  },
  executivo: {  // Phenom 300
    nome: 'Jato executivo', escala: 0.8,
    d: 'M-0.62 -14.2L-0.97 -13.43L-1.29 -12.41L-1.51 -11.39L-1.65 -10.37L-1.72 -9.1L-1.72 -3.1L-15.5 1.88L-15.5 3.79L-1.72 1.88L-1.72 3.32L-1.91 3.08L-2.1 2.95L-2.34 2.86L-2.71 2.84L-2.95 2.9L-3.17 3.01L-3.26 3.08L-3.41 3.26L-3.51 3.47L-3.54 3.69L-3.54 7.39L-3.25 9.34L-1.91 9.34L-1.63 7.39L-1.63 6.24L-1.45 8.22L-1.19 10.34L-5.74 12.78L-5.74 14.12L-0.7 13.4L-0.42 14.96L0.42 14.96L0.7 13.4L5.74 14.12L5.74 12.78L1.19 10.34L1.45 8.22L1.63 6.24L1.63 7.39L1.91 9.34L3.25 9.34L3.54 7.39L3.54 3.69L3.51 3.47L3.41 3.26L3.26 3.08L3.17 3.01L2.95 2.9L2.71 2.84L2.34 2.86L2.1 2.95L1.91 3.08L1.72 3.32L1.72 1.88L15.5 3.79L15.5 1.88L1.72 -3.1L1.71 -9.35L1.62 -10.63L1.41 -11.9L1.22 -12.67L0.97 -13.43L0.62 -14.2L0.3 -14.71L0 -14.96L-0.3 -14.71Z',
  },
  leve: {  // Cessna 172
    nome: 'Aviação leve', escala: 0.8,
    d: 'M-2.68 -11.33L-0.51 -11.33L-1.18 -10.65L-1.41 -8.96L-1.58 -6.99L-1.58 -6.28L-15.08 -6.09L-15.44 -5.72L-15.5 -4.31L-15.36 -3.1L-14.94 -2.87L-7.33 -1.69L-1.58 -1.69L-0.62 8.51L-4.88 9.07L-4.88 11.19L-0.51 11.61L-0.34 11.84L0.34 11.84L0.51 11.61L4.88 11.19L4.88 9.07L0.62 8.51L1.58 -1.69L7.33 -1.69L14.94 -2.87L15.36 -3.1L15.5 -4.31L15.44 -5.72L15.08 -6.09L1.58 -6.28L1.58 -6.99L1.41 -8.96L1.18 -10.65L0.51 -11.33L2.68 -11.33L2.68 -11.84L-2.68 -11.84Z',
  },
  helicoptero: {  // AS350 Esquilo
    nome: 'Helicóptero', escala: 0.9, rotor: 3,
    d: 'M-0.57 -7.73L-0.8 -7.61L-0.97 -7.49L-1.23 -7.26L-1.42 -7.02L-1.57 -6.79L-1.74 -6.43L-1.92 -5.84L-1.98 -5.49L-2 -5.13L-2.01 -0.87L-1.53 0.87L-0.7 2.4L-0.44 3.92L-0.35 10.14L-2.83 10.25L-2.83 11.45L-0.35 11.55L-0.33 14.61L-0.65 14.82L-0.65 15.98L0.65 15.98L0.65 14.82L0.33 14.61L0.35 11.55L2.83 11.45L2.83 10.25L0.35 10.14L0.44 3.92L0.7 2.4L1.53 0.87L2.01 -0.87L2 -5.25L1.92 -5.84L1.74 -6.43L1.49 -6.9L1.33 -7.14L1.11 -7.38L0.8 -7.61L0.57 -7.73L0 -7.85Z',
  },
  helicoptero_militar: {  // UH-60 Black Hawk
    nome: 'Helicóptero militar', escala: 0.95, rotor: 4,
    d: 'M-0.41 -6.28L-0.74 -6.01L-0.98 -5.74L-1.18 -5.47L-1.43 -5.07L-1.74 -4.4L-1.86 -4L-1.93 -3.6L-1.97 -3.07L-1.97 4.38L-1.9 4.75L-1.53 5.04L-1.02 5.29L-0.73 5.62L-0.64 6.13L-0.28 11.68L-0.23 12.63L-3.2 12.78L-3.2 13.72L-0.23 14.09L-0.32 16L0.32 16L0.23 14.09L3.2 13.72L3.2 12.78L0.23 12.63L0.28 11.68L0.64 6.13L0.73 5.62L1.02 5.29L1.53 5.04L1.9 4.75L1.97 4.38L1.97 -3.2L1.89 -3.87L1.74 -4.4L1.43 -5.07L1.08 -5.61L0.74 -6.01L0.41 -6.28Z',
  },
  planador: {
    nome: 'Planador', escala: 0.8,
    d: 'M-0.79 0.17L-0.38 4L-0.32 5.67L-2.89 5.86L-2.89 7.1L-0.1 7.36L-0.1 7.1L0.1 7.1L0.1 7.36L2.89 7.1L2.89 5.86L0.32 5.67L0.38 4L0.79 0.17L15.5 -0.8L15.5 -2.2L1.02 -2.6L1.01 -4.92L0.91 -5.78L0.72 -6.52L0.46 -7.05L0.16 -7.33L0 -7.36L-0.16 -7.33L-0.46 -7.05L-0.72 -6.52L-0.91 -5.78L-1.01 -4.92L-1.02 -2.6L-15.5 -2.2L-15.5 -0.8Z',
  },
  drone: {
    nome: 'Drone', escala: 0.75,
    d: 'M-1.07 0.91L-0.71 5.06L-4.03 6.86L-4.03 8.49L-2.33 7.99L-2.33 8.33L2.33 8.33L2.33 7.99L4.03 8.49L4.03 6.86L0.71 5.06L1.07 0.91L15.5 0L15.5 -1.51L1.21 -1.96L1.21 -6.16L1.15 -6.88L0.98 -7.53L0.71 -8.04L0.37 -8.37L0 -8.49L-0.37 -8.37L-0.71 -8.04L-0.98 -7.53L-1.15 -6.88L-1.21 -6.16L-1.21 -1.96L-15.5 -1.51L-15.5 0Z',
  },
  balao: {
    nome: 'Balão', escala: 0.6, semRumo: true,
    d: 'M0 -11A8.5 8.5 0 1 1 -0.01 -11ZM-2.5 7.5L2.5 7.5L2.5 11L-2.5 11Z',
  },
  veiculo: {
    nome: 'Veículo em solo', escala: 0.6,
    d: 'M-4.5 -7L4.5 -7L4.5 7L-4.5 7Z',
  },
};
for (const f of Object.values(FORMAS)) f.caminho = new Path2D(f.d);

// Grupos do filtro por tipo
export const GRUPOS = [
  { id: 'comercial', nome: 'Linhas aéreas', forma: 'comercial' },
  { id: 'executivo', nome: 'Regional e executivo', forma: 'executivo' },
  { id: 'leve', nome: 'Aviação leve', forma: 'leve' },
  { id: 'helicoptero', nome: 'Helicópteros', forma: 'helicoptero' },
  { id: 'militar', nome: 'Militares', forma: 'caca' },
  { id: 'outros', nome: 'Outros', forma: 'planador' },
];

// Modelos (designador ICAO) para quando a categoria não vem ou não basta
const conjunto = s => new Set(s.split(' '));
const HELICOPTEROS = conjunto('R22 R44 R66 AS50 AS55 AS65 AS32 AS3B EC20 EC25 EC30 EC35 EC45 EC55 EC75 H160 B06 B06T B206 B407 B412 B429 B505 B212 S76 S92 S61 A109 A119 A139 A169 A189 BK17 H60 S70 UH1 H500 MD52 MD60 NH90 H47 H64');
const HELICOPTEROS_MILITARES = conjunto('H60 S70 UH1 H47 H64');
const QUADRIMOTORES = conjunto('A388 B741 B742 B743 B744 B748 B74S A342 A343 A345 A346 IL96 A124 C5M');
const GRANDES = conjunto('A306 A30B A310 A332 A333 A338 A339 A359 A35K B762 B763 B764 B772 B773 B77L B77W B778 B779 B788 B789 B78X MD11');
const CARGUEIROS = conjunto('C130 C30J E390 KC39 A400 C295 CN35 C27J C160 AN12 AN26 AN32 IL76 C17');
const TURBOELICES = conjunto('AT43 AT44 AT45 AT46 AT72 AT73 AT75 AT76 DH8A DH8B DH8C DH8D E110 E120 SF34 JS31 JS32 JS41 D328 B190 F50 L410 C212');
const CACAS = conjunto('F5 F15 F16 F18H F18S F22 F35 EUFI RFAL T38 A10 HAWK L39');
// Jatos executivos leves: o transponder costuma informar categoria A1 (leve), mas são jatos
const JATOS_EXECUTIVOS = conjunto('C500 C501 C510 C525 C25A C25B C25C C25M C550 C560 C56X C680 C68A C700 C750 E50P E55P E545 E550 HDJT EA50 SF50 PC24 LJ31 LJ35 LJ40 LJ45 LJ60 LJ75 PRM1 BE40 H25B G150 G280 CL30 CL35 FA10 FA20 FA50 F900 F2TH FA7X GLF4 GLF5 GLF6 GLEX GL5T GL7T');
const FABRICANTES_LEVES = /\b(CESSNA|PIPER|BEECH|CIRRUS|DIAMOND|MOONEY|TECNAM|ROBIN|SOCATA|NEIVA|AERO BOERO|EXTRA|VANS|GRUMMAN AMERICAN)\b/i;

export function classificar(a) {
  const tipo = (a.t || '').toUpperCase();
  const cat = a.category || '';
  const militar = (a.dbFlags & 1) === 1;
  let forma;
  if (cat === 'A7' || HELICOPTEROS.has(tipo)) forma = militar || HELICOPTEROS_MILITARES.has(tipo) ? 'helicoptero_militar' : 'helicoptero';
  else if (cat === 'A6' || CACAS.has(tipo)) forma = 'caca';
  else if (CARGUEIROS.has(tipo)) forma = 'cargueiro';
  else if (QUADRIMOTORES.has(tipo)) forma = 'jumbo';
  else if (cat === 'A5' || GRANDES.has(tipo)) forma = 'pesado';
  else if (TURBOELICES.has(tipo)) forma = 'turboelice';
  else if (JATOS_EXECUTIVOS.has(tipo)) forma = 'executivo';
  else if (cat === 'A3' || cat === 'A4') forma = 'comercial';
  else if (cat === 'A2') forma = 'executivo';
  else if (cat === 'A1' || cat === 'B4') forma = 'leve';
  else if (cat === 'B1') forma = 'planador';
  else if (cat === 'B2') forma = 'balao';
  else if (cat === 'B6') forma = 'drone';
  else if (/^C\d$/.test(cat)) forma = 'veiculo';
  // Sem categoria: tenta pelo fabricante; se não der, usa a silhueta padrão
  else if (FABRICANTES_LEVES.test(a.desc || '')) forma = 'leve';
  else forma = 'comercial';
  const grupo = militar ? 'militar'
    : {
      comercial: 'comercial', pesado: 'comercial', jumbo: 'comercial', cargueiro: 'comercial',
      turboelice: 'executivo', executivo: 'executivo', leve: 'leve',
      helicoptero: 'helicoptero', helicoptero_militar: 'helicoptero', caca: 'militar',
    }[forma] || 'outros';
  const conhecido = [HELICOPTEROS, CACAS, CARGUEIROS, QUADRIMOTORES, GRANDES, TURBOELICES, JATOS_EXECUTIVOS].some(l => l.has(tipo));
  return { forma, grupo, militar, semCategoria: !cat && !conhecido && !FABRICANTES_LEVES.test(a.desc || '') };
}

// Ícone SVG de uma forma (busca, filtros e painel)
export function iconeForma(forma, cor, angulo = 0) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-16 -16 32 32');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', FORMAS[forma].d);
  path.setAttribute('fill', cor);
  path.setAttribute('stroke', 'rgba(0, 0, 0, 0.5)');
  path.setAttribute('stroke-width', '1');
  if (angulo) path.setAttribute('transform', `rotate(${angulo})`);
  svg.append(path);
  const pas = FORMAS[forma].rotor || 0;
  if (pas) {
    const disco = document.createElementNS(SVG_NS, 'circle');
    disco.setAttribute('r', '12.5');
    disco.setAttribute('fill', cor);
    disco.setAttribute('stroke', 'none');
    disco.setAttribute('opacity', '0.18');
    svg.prepend(disco);
  }
  for (let i = 0; i < pas; i++) {
    const pa = document.createElementNS(SVG_NS, 'path');
    pa.setAttribute('d', 'M0 -1.2H12.5V1.2H0Z');
    pa.setAttribute('fill', cor);
    pa.setAttribute('stroke', 'rgba(0, 0, 0, 0.5)');
    pa.setAttribute('stroke-width', '1');
    pa.setAttribute('opacity', '0.65');
    pa.setAttribute('transform', `rotate(${angulo + 30 + (i * 360) / pas})`);
    svg.append(pa);
  }
  return svg;
}
