console.log('🔥 adminGrupos.ts EJECUTADO');

import { db } from '../utils/firebase';
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

/* ======================================================
   TIPOS
====================================================== */

interface Player {
  id: string;
  name: string;
  photo: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
}

interface Match extends MatchData {
  id: string;
}

interface MatchData {
  player1: string;
  player2: string;
  winner: string;
  game: string;
  timestamp: number;
}

/* ======================================================
   ESTADO GLOBAL
====================================================== */

const groupPlayers: Record<string, Player[]> = {
  A: [],
  B: [],
  C: [],
  D: [],
};

const groupMatches: Record<string, Match[]> = {
  A: [],
  B: [],
  C: [],
  D: [],
};

/* ======================================================
   MAPEO OSU IDS
====================================================== */

const PLAYER_OSU_IDS: Record<string, number | null> = {
  '1': 4881251,
  '2': 2546001,
  '3': 11786864,
  '4': 5339515,
  '5': 13058814,
  '6': 5386106,
  '7': 11022739,
  '8': 5298487,
  '9': 5619615,
  '10': 1603962,
  '11': 36679874,
  '12': 11207004,
  '13': 18946207,
  '14': 6194830,
  '15': 7963246,
  '16': 36471978,
};

/* ======================================================
   HELPERS
====================================================== */

function getPlayerPhoto(id: string): string {
  const osuId = PLAYER_OSU_IDS[id];
  return osuId ? `https://a.ppy.sh/${osuId}` : '/mascota.png';
}

function getPlayerName(id: string): string {
  const option = document.querySelector<HTMLSelectElement>(
    `select.player-select option[value="${id}"]`
  );
  return option?.textContent ?? 'Unknown';
}

/* ======================================================
   INIT
====================================================== */

['A', 'B', 'C', 'D'].forEach(initGroup);

function initGroup(group: string): void {
  const groupRef = doc(db, 'groups', `group${group}`);

  onSnapshot(groupRef, snapshot => {
    if (!snapshot.exists()) return;

    groupPlayers[group] = snapshot.data().players ?? [];
    updateStandings(group);
    updateMatchSelects(group);
  });

  onSnapshot(
  collection(db, 'groups', `group${group}`, 'matches'),
  snap => {
    groupMatches[group] = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as MatchData),
    }));

    updateStandings(group);
    updateMatchHistory(group);
  }
);
}

/* ======================================================
   GUARDAR GRUPOS
====================================================== */

document
  .querySelectorAll<HTMLButtonElement>('.save-group-btn')
  .forEach(btn => {
    btn.addEventListener('click', async () => {
      const group = btn.dataset.group;
      if (!group) return;

      const ids = [1, 2, 3, 4].map(n => {
        const el = document.getElementById(
          `player${group}${n}`
        ) as HTMLSelectElement | null;
        return el?.value ?? '';
      });

      if (ids.includes('') || new Set(ids).size !== 4) {
        alert('Selección inválida de jugadores');
        return;
      }

      const players: Player[] = ids.map(id => ({
        id,
        name: getPlayerName(id),
        photo: getPlayerPhoto(id),
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
      }));

      await setDoc(doc(db, 'groups', `group${group}`), {
        players,
        updatedAt: Date.now(),
      });

      alert(`Grupo ${group} guardado correctamente`);
    });
  });

/* ======================================================
   REGISTRAR PARTIDOS
====================================================== */

document
  .querySelectorAll<HTMLButtonElement>('.add-match-btn')
  .forEach(btn => {
    btn.addEventListener('click', async () => {
      const group = btn.dataset.group;
      if (!group) return;

      const p1 = (document.getElementById(
        `matchPlayer1${group}`
      ) as HTMLSelectElement | null)?.value;

      const p2 = (document.getElementById(
        `matchPlayer2${group}`
      ) as HTMLSelectElement | null)?.value;

      const game = (document.getElementById(
        `matchGame${group}`
      ) as HTMLSelectElement | null)?.value;

      const winnerSel = (document.getElementById(
        `matchWinner${group}`
      ) as HTMLSelectElement | null)?.value;

      if (!p1 || !p2 || !game || !winnerSel || p1 === p2) {
        alert('Datos de partido inválidos');
        return;
      }

      const match: MatchData = {
        player1: p1,
        player2: p2,
        game,
        winner: winnerSel === '1' ? p1 : p2,
        timestamp: Date.now(),
      };

    await addDoc(
        collection(db, 'groups', `group${group}`, 'matches'),
        match
        );
    });
  });

  /* ======================================================
   QUITAR JUGADORES DEL GRUPO (BORRADO TOTAL)
====================================================== */

document
  .querySelectorAll<HTMLButtonElement>('.reset-players-btn')
  .forEach(btn => {
    btn.addEventListener('click', async () => {
      const group = btn.dataset.group;
      if (!group) return;

      if (
        !confirm(
          `⚠️ Esto eliminará TODOS los jugadores y partidos del grupo ${group}. ¿Continuar?`
        )
      )
        return;

      try {
        const batch = writeBatch(db);

        /* borrar matches */
        const matchesRef = collection(
          db,
          'groups',
          `group${group}`,
          'matches'
        );
        const matchesSnap = await getDocs(matchesRef);
        matchesSnap.forEach(m => batch.delete(m.ref));

        /* vaciar grupo */
        const groupRef = doc(db, 'groups', `group${group}`);
        batch.set(groupRef, {
          players: [],
          updatedAt: Date.now(),
        });

        await batch.commit();
        alert(`Grupo ${group} vaciado correctamente`);
      } catch (err) {
        console.error(err);
        alert('Error al quitar jugadores');
      }
    });
  });


  /* ======================================================
   RESETEAR MATCHES (mantiene jugadores)
====================================================== */

document
  .querySelectorAll<HTMLButtonElement>('.reset-matches-btn')
  .forEach(btn => {
    btn.addEventListener('click', async () => {
      const group = btn.dataset.group;
      if (!group) return;

      if (!confirm(`¿Resetear todos los partidos del grupo ${group}?`)) return;

      try {
        const batch = writeBatch(db);

        /* borrar matches */
        const matchesRef = collection(
          db,
          'groups',
          `group${group}`,
          'matches'
        );
        const matchesSnap = await getDocs(matchesRef);
        matchesSnap.forEach(m => batch.delete(m.ref));

        /* resetear stats */
        const groupRef = doc(db, 'groups', `group${group}`);
        const groupSnap = await getDoc(groupRef);

        if (groupSnap.exists()) {
          const players = (groupSnap.data().players ?? []).map(
            (p: Player) => ({
              ...p,
              played: 0,
              wins: 0,
              losses: 0,
              points: 0,
            })
          );

          batch.set(groupRef, {
            players,
            updatedAt: Date.now(),
          });
        }

        await batch.commit();
        alert(`Partidos del grupo ${group} reseteados`);
      } catch (err) {
        console.error(err);
        alert('Error al resetear partidos');
      }
    });
  });

/* ======================================================
   STANDINGS
====================================================== */

function updateStandings(group: string): void {
  const tbody = document.getElementById(`standings${group}`);
  if (!tbody) return;

  const players = [...groupPlayers[group]];

  players.forEach(p => {
    p.played = 0;
    p.wins = 0;
    p.losses = 0;
    p.points = 0;
  });

  groupMatches[group].forEach(match => {
    const p1 = players.find(p => p.id === match.player1);
    const p2 = players.find(p => p.id === match.player2);
    if (!p1 || !p2) return;

    p1.played++;
    p2.played++;

    if (match.winner === p1.id) {
      p1.wins++;
      p1.points += 3;
      p2.losses++;
    } else {
      p2.wins++;
      p2.points += 3;
      p1.losses++;
    }
  });

  players.sort((a, b) => b.points - a.points);

  tbody.innerHTML = players
    .map(
      (p, i) => `
    <tr class="border-b hover:bg-gray-50 transition">
      <td class="p-3 font-bold">${i + 1}</td>
      <td class="p-3 font-semibold">${p.name}</td>
      <td class="p-3 text-center">${p.played}</td>
      <td class="p-3 text-center text-green-600 font-bold">${p.wins}</td>
      <td class="p-3 text-center text-red-600 font-bold">${p.losses}</td>
      <td class="p-3 text-center font-bold">${p.points}</td>
    </tr>
  `
    )
    .join('');
}

/* ======================================================
   SELECTS PARTIDOS
====================================================== */

function updateMatchSelects(group: string): void {
  const s1 = document.getElementById(
    `matchPlayer1${group}`
  ) as HTMLSelectElement | null;

  const s2 = document.getElementById(
    `matchPlayer2${group}`
  ) as HTMLSelectElement | null;

  if (!s1 || !s2) return;

  const options = groupPlayers[group]
    .map(p => `<option value="${p.id}">${p.name}</option>`)
    .join('');

  s1.innerHTML = `<option value="">Jugador 1</option>${options}`;
  s2.innerHTML = `<option value="">Jugador 2</option>${options}`;
}

/* ======================================================
   HISTORIAL
====================================================== */

function updateMatchHistory(group: string): void {
  const container = document.getElementById(`matchHistory${group}`);
  if (!container) return;

  if (groupMatches[group].length === 0) {
    container.innerHTML =
      '<p class="text-gray-500 text-center">No hay partidos</p>';
    return;
  }

  container.innerHTML = [...groupMatches[group]]
    .reverse()
    .map(match => {
      const p1 =
        groupPlayers[group].find(p => p.id === match.player1)?.name ??
        'Unknown';

      const p2 =
        groupPlayers[group].find(p => p.id === match.player2)?.name ??
        'Unknown';

      const win =
        groupPlayers[group].find(p => p.id === match.winner)?.name ??
        'Unknown';

      return `
        <div class="bg-white p-4 rounded-lg shadow space-y-1">
          <div class="font-semibold">${p1} vs ${p2}</div>
          <div class="text-sm">Juego: ${match.game}</div>
          <div class="text-green-600 font-bold">
            Ganador: ${win}
          </div>

          <!-- BOTÓN AQUÍ -->
          <button
            class="text-red-600 font-bold hover:underline delete-match-btn"
            data-group="${group}"
            data-id="${match.id}"
          >
            Eliminar
          </button>
        </div>
      `;
    })
    .join('');
}


document.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;

  if (!target.classList.contains('delete-match-btn')) return;

  const group = target.dataset.group;
  const matchId = target.dataset.id;

  if (!group || !matchId) return;

  if (!confirm('¿Eliminar este partido?')) return;

  try {
    await deleteDoc(doc(db, 'groups', `group${group}`, 'matches', matchId));

    console.log(`Match ${matchId} eliminado del grupo ${group}`);
  } catch (err) {
    console.error('Error eliminando match:', err);
  }
});
/* ======================================================
   TABS
====================================================== */

document.querySelectorAll<HTMLButtonElement>('.group-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const group = tab.dataset.group;
    if (!group) return;

    /* reset botones */
    document.querySelectorAll<HTMLButtonElement>('.group-tab').forEach(t => {
      t.classList.remove(
        'bg-[var(--color-accent)]',
        'text-white',
        'hover:opacity-90'
      );

      t.classList.add(
        'bg-gray-300',
        'text-gray-700',
        'hover:bg-gray-400'
      );
    });

    /* activar botón clickeado */
    tab.classList.remove(
      'bg-gray-300',
      'text-gray-700',
      'hover:bg-gray-400'
    );

    tab.classList.add(
      'bg-[var(--color-accent)]',
      'text-white',
      'hover:opacity-90'
    );

    /* ocultar contenidos */
    document.querySelectorAll<HTMLElement>('.group-content').forEach(c =>
      c.classList.add('hidden')
    );

    /* mostrar grupo seleccionado */
    document
      .querySelector<HTMLElement>(`.group-content[data-group="${group}"]`)
      ?.classList.remove('hidden');
  });
});
