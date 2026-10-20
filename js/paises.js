// País de registro pelo endereço ICAO e bandeiras

// País de registro pelo endereço ICAO de 24 bits (faixas alocadas pela ICAO)
const PAISES = [
  [0x008000, 0x00FFFF, 'ZA', 'África do Sul'], [0x010000, 0x017FFF, 'EG', 'Egito'],
  [0x020000, 0x027FFF, 'MA', 'Marrocos'], [0x040000, 0x040FFF, 'ET', 'Etiópia'],
  [0x06A000, 0x06AFFF, 'QA', 'Catar'], [0x0AC000, 0x0ACFFF, 'CO', 'Colômbia'],
  [0x0C2000, 0x0C2FFF, 'PA', 'Panamá'], [0x0D0000, 0x0D7FFF, 'MX', 'México'],
  [0x0D8000, 0x0DFFFF, 'VE', 'Venezuela'], [0x100000, 0x1FFFFF, 'RU', 'Rússia'],
  [0x300000, 0x33FFFF, 'IT', 'Itália'], [0x340000, 0x37FFFF, 'ES', 'Espanha'],
  [0x380000, 0x3BFFFF, 'FR', 'França'], [0x3C0000, 0x3FFFFF, 'DE', 'Alemanha'],
  [0x400000, 0x43FFFF, 'GB', 'Reino Unido'], [0x440000, 0x447FFF, 'AT', 'Áustria'],
  [0x448000, 0x44FFFF, 'BE', 'Bélgica'], [0x458000, 0x45FFFF, 'DK', 'Dinamarca'],
  [0x460000, 0x467FFF, 'FI', 'Finlândia'], [0x478000, 0x47FFFF, 'NO', 'Noruega'],
  [0x480000, 0x487FFF, 'NL', 'Países Baixos'], [0x488000, 0x48FFFF, 'PL', 'Polônia'],
  [0x490000, 0x497FFF, 'PT', 'Portugal'], [0x4A8000, 0x4AFFFF, 'SE', 'Suécia'],
  [0x4B0000, 0x4B7FFF, 'CH', 'Suíça'], [0x4B8000, 0x4BFFFF, 'TR', 'Turquia'],
  [0x4CA000, 0x4CAFFF, 'IE', 'Irlanda'], [0x4CC000, 0x4CCFFF, 'IS', 'Islândia'],
  [0x4D0000, 0x4D03FF, 'LU', 'Luxemburgo'], [0x710000, 0x717FFF, 'SA', 'Arábia Saudita'],
  [0x718000, 0x71FFFF, 'KR', 'Coreia do Sul'], [0x738000, 0x73FFFF, 'IL', 'Israel'],
  [0x768000, 0x76FFFF, 'SG', 'Singapura'], [0x780000, 0x7BFFFF, 'CN', 'China'],
  [0x7C0000, 0x7FFFFF, 'AU', 'Austrália'], [0x800000, 0x83FFFF, 'IN', 'Índia'],
  [0x840000, 0x87FFFF, 'JP', 'Japão'], [0x896000, 0x896FFF, 'AE', 'Emirados Árabes'],
  [0xA00000, 0xAFFFFF, 'US', 'Estados Unidos'], [0xC00000, 0xC3FFFF, 'CA', 'Canadá'],
  [0xC80000, 0xC87FFF, 'NZ', 'Nova Zelândia'], [0xE00000, 0xE3FFFF, 'AR', 'Argentina'],
  [0xE40000, 0xE7FFFF, 'BR', 'Brasil'], [0xE80000, 0xE80FFF, 'CL', 'Chile'],
  [0xE84000, 0xE84FFF, 'EC', 'Equador'], [0xE88000, 0xE88FFF, 'PY', 'Paraguai'],
  [0xE8C000, 0xE8CFFF, 'PE', 'Peru'], [0xE90000, 0xE90FFF, 'UY', 'Uruguai'],
  [0xE94000, 0xE94FFF, 'BO', 'Bolívia'],
];
export function paisDoHex(hex) {
  const n = parseInt(hex, 16);
  const p = PAISES.find(([ini, fim]) => n >= ini && n <= fim);
  if (!p) return null;
  const bandeira = String.fromCodePoint(...[...p[2]].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  return `${bandeira} ${p[3]}`;
}

export const NOME_PAIS = Object.fromEntries(PAISES.map(p => [p[2], p[3]]));
export const bandeira = iso => /^[A-Z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '';
