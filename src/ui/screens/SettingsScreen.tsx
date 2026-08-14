import { useRef, useState } from 'preact/hooks';
import { deleteCategory, getCategories, insertCategory, updateCategory } from '../../db/database';
import type { Category } from '../../db/types';
import { CATEGORY_COLOR_PRESETS, CATEGORY_EMOJI_PRESETS } from '../../domain/categoryPresets';
import { exportFullBackup, importFullBackup } from '../../services/backupService';
import {
  checkExpiringWarranties,
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
} from '../../services/notificationService';
import { useLiveQuery } from '../../state/useLiveQuery';
import { alertDialog, confirmDialog } from '../components/ConfirmDialog';
import { promptText } from '../components/PromptDialog';
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
    <div class="form-sheet">
      <h3>{category.nome}</h3>
      <span class="section-label">Ícone</span>
      <div class="preset-grid">
        <button
          class={icone == null ? 'preset-swatch preset-swatch--active' : 'preset-swatch'}
          onClick={() => setIcone(null)}
        >
          —
        </button>
        {CATEGORY_EMOJI_PRESETS.map((e) => (
          <button
            key={e}
            class={icone === e ? 'preset-swatch preset-swatch--active' : 'preset-swatch'}
            onClick={() => setIcone(e)}
          >
            {e}
          </button>
        ))}
      </div>
      <span class="section-label">Cor</span>
      <div class="preset-grid">
        <button
          class={cor == null ? 'preset-swatch preset-swatch--active' : 'preset-swatch'}
          onClick={() => setCor(null)}
        >
          —
        </button>
        {CATEGORY_COLOR_PRESETS.map((c) => (
          <button
            key={c}
            class={cor === c ? 'color-swatch color-swatch--active' : 'color-swatch'}
            style={{ background: c }}
            onClick={() => setCor(c)}
          />
        ))}
      </div>
      <button class="btn-filled btn-block" onClick={salvar}>
        Salvar
      </button>
    </div>
  );
}

export function SettingsScreen() {
  const categorias = useLiveQuery(() => getCategories(), []);
  const backupFileRef = useRef<HTMLInputElement>(null);
  const [notifStatus, setNotifStatus] = useState(notificationPermission());

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

  return (
    <div class="screen">
      <header class="appbar">
        <h1>Configurações</h1>
      </header>
      <div class="screen-body">
        <div class="section-label">Categorias</div>
        {categorias === undefined ? (
          <div class="centered">Carregando…</div>
        ) : (
          categorias.map((c) => (
            <div class="list-row" key={c.id}>
              <button class="list-row-main" onClick={() => openCategoryEditor(c)}>
                {c.cor && <span class="color-dot" style={{ background: c.cor }} />}
                <span>
                  {c.icone ? `${c.icone} ` : ''}
                  {c.nome}
                </span>
              </button>
              <button class="icon-btn" aria-label="Excluir categoria" onClick={() => deleteCategory(c.id!)}>
                🗑
              </button>
            </div>
          ))
        )}
        <button class="list-row list-row--action" onClick={novaCategoria}>
          <span>＋ Nova categoria</span>
        </button>

        <hr />

        <div class="section-label">Backup</div>
        <button class="list-row list-row--action" onClick={onExportBackup}>
          <span>⬆️ Exportar backup</span>
        </button>
        <button class="list-row list-row--action" onClick={() => backupFileRef.current?.click()}>
          <span>⬇️ Importar backup</span>
        </button>
        <input
          ref={backupFileRef}
          type="file"
          accept="application/json"
          class="hidden-file-input"
          onChange={onImportBackupFile}
        />

        <hr />

        <div class="section-label">Notificações</div>
        {!notificationsSupported() ? (
          <div class="list-row list-row--muted">
            <span>Notificações não são suportadas neste navegador.</span>
          </div>
        ) : (
          <>
            <button class="list-row list-row--action" onClick={onToggleNotifications} disabled={notifStatus === 'granted'}>
              <span>
                {notifStatus === 'granted' ? '🔔 Notificações ativadas' : '🔕 Ativar notificações de garantia'}
              </span>
            </button>
            <div class="list-row list-row--muted">
              <span class="card-subtitle">
                Avisa quando a garantia de um item está prestes a vencer. Só funciona enquanto o app
                está aberto — não há aviso agendado com o app fechado.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
