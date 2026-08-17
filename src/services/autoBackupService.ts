import { createAutoBackupSnapshot, getLatestSnapshotDate } from '../db/database';

const MIN_INTERVAL_HOURS = 12;

/** Roda ao abrir o app: se o snapshot automático mais recente tem mais de
 * `MIN_INTERVAL_HOURS`, tira um novo. Mantém um backup rolando sem exigir
 * exportação manual do usuário (ver Configurações > Backup automático). */
export async function maybeCreateAutoBackup(): Promise<void> {
  try {
    const latest = await getLatestSnapshotDate();
    const hoursSince = latest ? (Date.now() - latest.getTime()) / 3_600_000 : Infinity;
    if (hoursSince >= MIN_INTERVAL_HOURS) {
      await createAutoBackupSnapshot();
    }
  } catch (err) {
    console.error('maybeCreateAutoBackup falhou', err);
  }
}
