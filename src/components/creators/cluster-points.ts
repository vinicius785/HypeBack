export interface ClusterPoint {
  id: string | number;
  /** Posição no plano de pixels do mapa (no zoom atual). */
  x: number;
  y: number;
}

export interface Cluster {
  /** Ids dos pontos reunidos (sempre ao menos um). */
  ids: Array<string | number>;
  /** Centro do grupo (média das posições). */
  x: number;
  y: number;
}

/**
 * Agrupa pontos que ficariam a menos de `radius` px um do outro no zoom atual.
 * Guloso e determinístico: cada ponto entra no primeiro grupo cujo centro esteja
 * dentro do raio; o centro do grupo é a média dos membros. Aproximar o mapa afasta
 * os pontos em pixels, e os grupos se desfazem sozinhos.
 */
export function clusterPoints(points: ClusterPoint[], radius: number): Cluster[] {
  const clusters: Array<Cluster & { sx: number; sy: number }> = [];
  const grid = new Map<string, Array<Cluster & { sx: number; sy: number }>>();
  const cell = (v: number) => Math.floor(v / radius);
  const r2 = radius * radius;

  for (const p of points) {
    const cx = cell(p.x);
    const cy = cell(p.y);
    let home: (Cluster & { sx: number; sy: number }) | undefined;
    outer: for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cy - 1; j <= cy + 1; j++) {
        for (const c of grid.get(`${i}:${j}`) ?? []) {
          const dx = c.x - p.x;
          const dy = c.y - p.y;
          if (dx * dx + dy * dy <= r2) {
            home = c;
            break outer;
          }
        }
      }
    }
    if (home) {
      home.ids.push(p.id);
      home.sx += p.x;
      home.sy += p.y;
      home.x = home.sx / home.ids.length;
      home.y = home.sy / home.ids.length;
    } else {
      const c = { ids: [p.id], x: p.x, y: p.y, sx: p.x, sy: p.y };
      clusters.push(c);
      const key = `${cx}:${cy}`;
      const bucket = grid.get(key);
      if (bucket) bucket.push(c);
      else grid.set(key, [c]);
    }
  }
  return clusters.map(({ ids, x, y }) => ({ ids, x, y }));
}
