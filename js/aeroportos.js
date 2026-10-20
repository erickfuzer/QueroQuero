// Base de aeroportos do OurAirports

// Base enxuta do OurAirports (médios e grandes com voo regular), carregada só quando for usada
export let aeroportos = null;
let carregandoAeroportos = null;
export const semAcento = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
export function carregarAeroportos() {
  if (!carregandoAeroportos) {
    carregandoAeroportos = fetch('assets/dados/aeroportos.json')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(lista => {
        aeroportos = lista.map(([icao, iata, nome, cidade, pais, lat, lon, porte]) =>
          ({ icao, iata, nome, cidade, pais, lat, lon, porte, chave: semAcento(`${nome} ${cidade}`) }));
        return aeroportos;
      })
      .catch(() => { carregandoAeroportos = null; return null; });
  }
  return carregandoAeroportos;
}
