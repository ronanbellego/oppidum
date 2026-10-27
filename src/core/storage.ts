/**
 * Où l'on range la sauvegarde. Le jeu ne connaît que cette interface : passer un jour à des sauvegardes
 * en ligne reviendra à écrire une seconde implémentation, sans toucher au reste.
 */
export interface SaveStore {
  read(): string | null;
  write(text: string): boolean;
  clear(): void;
}

/**
 * Sauvegarde dans le navigateur. Lit aussi les anciennes clés, pour reprendre les parties
 * enregistrées avant le passage au format versionné. Toute erreur d'accès est absorbée :
 * un navigateur en navigation privée ou au stockage bloqué joue simplement sans sauvegarde.
 */
export function localStore(key: string, legacyKeys: string[] = []): SaveStore {
  const ls = (): Storage | null => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  };
  return {
    read() {
      const s = ls();
      if (!s) return null;
      try {
        for (const k of [key, ...legacyKeys]) {
          const v = s.getItem(k);
          if (v) return v;
        }
      } catch {
        /* stockage inaccessible */
      }
      return null;
    },
    write(text) {
      const s = ls();
      if (!s) return false;
      try {
        s.setItem(key, text);
        for (const k of legacyKeys) s.removeItem(k);
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      const s = ls();
      try {
        for (const k of [key, ...legacyKeys]) s?.removeItem(k);
      } catch {
        /* stockage inaccessible */
      }
    },
  };
}

/** Sauvegarde en mémoire, pour les tests. */
export function memoryStore(initial: string | null = null): SaveStore & { value: string | null } {
  const st = {
    value: initial,
    read: () => st.value,
    write: (t: string) => ((st.value = t), true),
    clear: () => {
      st.value = null;
    },
  };
  return st;
}
