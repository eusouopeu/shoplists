import { deleteCategory, getCategories, insertCategory } from '../../db/database';
import { useLiveQuery } from '../../state/useLiveQuery';
import { promptText } from '../components/PromptDialog';

export function SettingsScreen() {
  const categorias = useLiveQuery(() => getCategories(), []);

  const novaCategoria = async () => {
    const nome = await promptText({ title: 'Nova categoria', confirmLabel: 'Criar' });
    if (nome) await insertCategory(nome);
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
              <span>{c.nome}</span>
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
        <div class="list-row list-row--muted">
          <div>
            <div>Garantia padrão por categoria e notificações</div>
            <div class="card-subtitle">Chegam nas Fases 4 e 5.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
