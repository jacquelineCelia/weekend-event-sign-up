import { getPool } from './db';
import { currentViewer, type Viewer } from './session';

/** The people whose sign-ups this viewer may see and manage. */
export async function viewerPersonIds(v: Viewer | null): Promise<string[]> {
  if (!v) return [];
  if (v.kind === 'person') {
    const r = await getPool().query<{ id: string }>('select id from people where id = $1', [v.personId]);
    return r.rows.map((x) => x.id);
  }
  const r = await getPool().query<{ id: string }>('select id from people where phone = $1 order by created_at', [v.phone]);
  return r.rows.map((x) => x.id);
}

/** The signed-in viewer and the people they cover (empty when signed out). */
export async function currentOwners() {
  const viewer = await currentViewer();
  return { viewer, ids: await viewerPersonIds(viewer) };
}
