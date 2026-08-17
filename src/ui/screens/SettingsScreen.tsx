import { useRef, useState } from 'preact/hooks';
import {
  deleteCategory,
  getCategories,
  insertCategory,
  listBackupSnapshots,
  restoreBackupSnapshot,
  updateCategory,
} from '../../db/database';
import type { BackupSnapshotSummary } from '../../db/database';
import type { Category } from '../../db/types';
import { CATEGORY_COLOR_PRESETS, CATEGORY_EMOJI_PRESETS } from '../../domain/categoryPresets';
import { exportFullBackup, importFullBackup } from '../../services/backupService';
import {
  checkExpiringWarranties,
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
} from '../../services/notificationService';
import { getThemePreference, setThemePreference } from '../../services/themeService';
import type { ThemePreference } from '../../services/themeService';
import { useLiveQuery } from '../../state/useLiveQuery';
import { alertDialog, confirmDialog } from '../components/ConfirmDialog';
import { promptText } from '../components/PromptDialog';
import { IconArchive, IconBell, IconCloudUpload, IconDownloadTray, IconMoon, IconSun, IconUploadTray } from '../icons';
import { AppBar, AppBarTitle, ListRow, ScreenBody, SectionLabel, Screen, Segmented, TextButton } from '../kit';
import { openSheet } from '../overlay';

function openCategoryEditor(category: Category): Promise<void> {
  return openSheet<void>((close) => <CategoryEditor category={category} close={close} />).then(() => undefined);
}

function CategoryEditor({ category, close }: { category: Category; close: (result?: void) => void }) {
  const [icone, setIcone] = useState(category.icone);
  const [cor, setCor] = useState(category.cor);

  const salvar = async () => {
    await updateCategory(category.id!, { icone, cor });
    close();
  };

  return (
    <div class="flex flex-col gap-4 p-5">
      <h3 class="m-0 text-lg font-bold">{category.nome}</h3>
      <SectionLabel>Ícone</SectionLabel>
      <div class="flex flex-wrap gap-2">
        <button
          class={`flex h-10 w-10 items-center justify-center rounded-lg border text-[1.1rem] ${
            icone == null ? 'border-2 border-accent' : 'border-border bg-surface'
          }`}
          onClick={() => setIcone(null)}
        >
          —
        </button>
        {CATEGORY_EMOJI_PRESETS.map((e) => (
          <button
            key={e}
            class={`flex h-10 w-10 items-center justify-center rounded-lg border text-[1.1rem] ${
              icone === e ? 'border-2 border-accent' : 'border-border bg-surface'
            }`}
            onClick={() => setIcone(e)}
          >
            {e}
          </button>
        ))}
      </div>
      <SectionLabel>Cor</SectionLabel>
      <div class="flex flex-wrap gap-2">
        <button
          class={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
            cor == null ? 'border-text' : 'border-transparent bg-surface'
          }`}
          onClick={() => setCor(null)}
        >
          —
        </button>
        {CATEGORY_COLOR_PRESETS.map((c) => (
          <button
            key={c}
            class={`h-8 w-8 rounded-full border-2 ${cor === c ? 'border-text' : 'border-transparent'}`}
            style={{ background: c }}
            onClick={() => setCor(c)}
          />
        ))}
      </div>
      <button class="w-full rounded-lg border border-black/10 bg-accent px-5 py-3 font-semibold text-accent-ink" onClick={salvar}>
        Salvar
      </button>
    </div>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
];

function formatSnapshotDate(d: Date): string {
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function openSnapshotsSheet(snapshots: BackupSnapshotSummary[]) {
  return openSheet<void>((close) => (
    <div class="py-3 pb-5">
      <div class="px-5 py-3 font-bold">Snapshots automáticos</div>
      {snapshots.map((s) => (
        <ListRow
          key={s.id}
          onClick={async () => {
            const ok = await confirmDialog({
              title: 'Restaurar este snapshot?',
              content: `Isso substitui todos os dados atuais pelos do snapshot de ${formatSnapshotDate(s.createdAt)}.`,
              confirmLabel: 'Restaurar',
            });
            if (ok) {
              await restoreBackupSnapshot(s.id);
              close();
              await alertDialog({ content: 'Snapshot restaurado com sucesso.' });
            }
          }}
        >
          <span class="px-1">{formatSnapshotDate(s.createdAt)}</span>
        </ListRow>
      ))}
      <div class="px-5 pt-2">
        <TextButton onClick={() => close()}>Fechar</TextButton>
      </div>
    </div>
  ));
}

export function SettingsScreen() {
  const categorias = useLiveQuery(() => getCategories(), []);
  const snapshots = useLiveQuery(() => listBackupSnapshots(), []);
  const backupFileRef = useRef<HTMLInputElement>(null);
  const [notifStatus, setNotifStatus] = useState(notificationPermission());
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference());

  const novaCategoria = async () => {
    const nome = await promptText({ title: 'Nova categoria', confirmLabel: 'Criar' });
    if (nome) await insertCategory(nome);
  };

  const onExportBackup = async () => {
    await exportFullBackup();
  };

  const onImportBackupFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    const ok = await confirmDialog({
      title: 'Restaurar backup?',
      content: 'Isso vai substituir TODOS os dados atuais do app (listas, itens, categorias e histórico) pelos do arquivo.',
      confirmLabel: 'Restaurar',
    });
    if (!ok) return;
    try {
      await importFullBackup(file);
      await alertDialog({ content: 'Backup restaurado com sucesso.' });
    } catch {
      await alertDialog({ title: 'Falha ao importar', content: 'O arquivo selecionado não é um backup válido.' });
    }
  };

  const onToggleNotifications = async () => {
    const result = await requestNotificationPermission();
    setNotifStatus(result);
    if (result === 'granted') void checkExpiringWarranties();
  };

  const onThemeChange = (v: ThemePreference) => {
    setTheme(v);
    setThemePreference(v);
  };

  return (
    <Screen>
      <AppBar>
        <AppBarTitle>Configurações</AppBarTitle>
      </AppBar>
      <ScreenBody>
        <SectionLabel>Aparência</SectionLabel>
        <div class="mb-4 flex items-center gap-3">
          <span class="text-text-muted">{theme === 'dark' ? <IconMoon size={20} /> : <IconSun size={20} />}</span>
          <div class="flex-1">
            <Segmented value={theme} onChange={onThemeChange} options={THEME_OPTIONS} />
          </div>
        </div>

        <hr class="my-4 border-border" />

        <SectionLabel>Categorias</SectionLabel>
        {categorias === undefined ? (
          <div class="py-4 text-center">Carregando…</div>
        ) : (
          categorias.map((c) => (
            <div class="flex items-center justify-between gap-2.5 border-b border-border py-3" key={c.id}>
              <button class="flex flex-1 items-center gap-2 text-left" onClick={() => openCategoryEditor(c)}>
                {c.cor && <span class="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />}
                <span>
                  {c.icone ? `${c.icone} ` : ''}
                  {c.nome}
                </span>
              </button>
              <TextButton onClick={() => deleteCategory(c.id!)}>Excluir</TextButton>
            </div>
          ))
        )}
        <ListRow action onClick={novaCategoria}>
          <span>＋ Nova categoria</span>
        </ListRow>

        <hr class="my-4 border-border" />

        <SectionLabel>Backup</SectionLabel>
        <ListRow action onClick={onExportBackup}>
          <span class="inline-flex items-center gap-2">
            <IconUploadTray size={18} /> Exportar backup
          </span>
        </ListRow>
        <ListRow action onClick={() => backupFileRef.current?.click()}>
          <span class="inline-flex items-center gap-2">
            <IconDownloadTray size={18} /> Importar backup
          </span>
        </ListRow>
        <input ref={backupFileRef} type="file" accept="application/json" class="hidden" onChange={onImportBackupFile} />

        <div class="flex items-center justify-between gap-2.5 border-b border-border py-3">
          <span class="inline-flex items-center gap-2 text-text-muted">
            <IconCloudUpload size={18} /> Backup automático
          </span>
          <span class="text-[0.85rem] text-text-muted">{snapshots?.length ?? 0} snapshot(s)</span>
        </div>
        <p class="mt-1 text-[0.85rem] text-text-muted">
          A cada 12h de uso, o app guarda uma cópia local completa (mantém as 5 mais recentes), sem
          precisar exportar manualmente.
        </p>
        {snapshots !== undefined && snapshots.length > 0 && (
          <ListRow action onClick={() => openSnapshotsSheet(snapshots)}>
            <span class="inline-flex items-center gap-2">
              <IconArchive size={18} /> Ver/restaurar snapshots
            </span>
          </ListRow>
        )}

        <hr class="my-4 border-border" />

        <SectionLabel>Notificações</SectionLabel>
        {!notificationsSupported() ? (
          <div class="py-3 text-text-muted">Notificações não são suportadas neste navegador.</div>
        ) : (
          <>
            <ListRow action={notifStatus !== 'granted'} muted={notifStatus === 'granted'} onClick={onToggleNotifications}>
              <span class="inline-flex items-center gap-2">
                <IconBell size={18} />
                {notifStatus === 'granted' ? 'Notificações ativadas' : 'Ativar notificações'}
              </span>
            </ListRow>
            <p class="mt-1 text-[0.85rem] text-text-muted">
              Avisa quando a garantia de um item está prestes a vencer e quando uma lista se aproxima ou
              ultrapassa o orçamento. Só funciona enquanto o app está aberto.
            </p>
          </>
        )}
      </ScreenBody>
    </Screen>
  );
}
