/**
 * DepthSorter — Ordenação dinâmica de profundidade 2.5D (Y-Sorting).
 * Ordena a cada frame avatares, cadeiras, mesas, cabines de DJ e plantas com base na
 * coordenada Y dos pés/base para criar sobreposição espacial realista.
 */

import type { DepthSortableEntity } from './types.ts';

export class DepthSorter {
  /**
   * Ordena todas as entidades em ordem crescente de `footY` (do fundo da sala para frente).
   * Critério de desempate: `subZ` e depois `id` para evitar cintilação (z-fighting).
   */
  sortEntities<T extends DepthSortableEntity>(entities: readonly T[]): T[] {
    return [...entities].sort((a, b) => {
      // Pista de dança fica sempre sob avatares e móveis
      if (a.kind === 'prop' && a.propType === 'dance_floor' && !(b.kind === 'prop' && b.propType === 'dance_floor')) {
        return -1;
      }
      if (b.kind === 'prop' && b.propType === 'dance_floor' && !(a.kind === 'prop' && a.propType === 'dance_floor')) {
        return 1;
      }

      const diffY = a.y - b.y;
      if (Math.abs(diffY) > 0.25) {
        return diffY;
      }

      const subZA = a.kind === 'prop' ? (a.subZ ?? 0) : 1;
      const subZB = b.kind === 'prop' ? (b.subZ ?? 0) : 1;
      if (subZA !== subZB) {
        return subZA - subZB;
      }

      return a.id.localeCompare(b.id);
    });
  }
}
