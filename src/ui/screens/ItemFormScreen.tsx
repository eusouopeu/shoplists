import { useEffect, useState } from 'preact/hooks';
import {
  deleteLink,
  getCategories,
  getItem,
  getLinksForItem,
  insertItem,
  insertLink,
  updateItemFields,
  updateLink,
} from '../../db/database';
import type { StoreType } from '../../db/types';
import { detectStore, storeLabel } from '../../domain/storeDetector';
import { fetchLinkMetadata } from '../../services/linkMetadataService';
import { useLiveQuery } from '../../state/useLiveQuery';
import { promptText } from '../components/PromptDialog';

interface LinkDraft {
  key: number;
  id?: number;
  url: string;
  loja: StoreType;
  tituloOriginal: string | null;
  imagemUrl: string | null;
  preco: number | null;
  escolhido: boolean;
  loading: boolean;
}

let draftKeySeq = 0;

export function ItemFormScreen({
  listId,
  itemId,
  prefillUrl,
  onBack,
}: {
  listId: number;
  itemId?: number;
  prefillUrl?: string;
  onBack: () => void;
}) {
  const isEdit = itemId != null;
  const categorias = useLiveQuery(() => getCategories(), []);

  const [nome, setNome] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [quantidade, setQuantidade] = useState('1');
  const [unidadesPorItem, setUnidadesPorItem] = useState('1');
  const [prazoGarantiaDias, setPrazoGarantiaDias] = useState('');
  const [links, setLinks] = useState<LinkDraft[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isEdit) {
        const item = await getItem(itemId!);
        const existingLinks = await getLinksForItem(itemId!);
        if (cancelled) return;
        setNome(item.nomeSimplificado);
        setQuantidade(String(item.quantidade));
        setUnidadesPorItem(String(item.unidadesPorItem));
        setPrazoGarantiaDias(item.prazoGarantiaDias != null ? String(item.prazoGarantiaDias) : '');
        setCategoriaId(item.categoriaId);
        setLinks(
          existingLinks.map((l) => ({
            key: draftKeySeq++,
            id: l.id,
            url: l.url,
            loja: l.loja,
            tituloOriginal: null,
            imagemUrl: l.imagemUrl,
            preco: l.preco,
            escolhido: l.escolhido,
            loading: false,
          })),
        );
        setLoadingExisting(false);
      } else if (prefillUrl) {
        await addLink(prefillUrl);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function addLink(url: string) {
    const loja = detectStore(url);
    const key = draftKeySeq++;
    setLinks((prev) => [
      ...prev,
      { key, url, loja, tituloOriginal: null, imagemUrl: null, preco: null, escolhido: false, loading: true },
    ]);

    const metadata = await fetchLinkMetadata(url, loja);
    setLinks((prev) =>
      prev.map((d) =>
        d.key === key
          ? { ...d, tituloOriginal: metadata.nome, imagemUrl: metadata.imagemUrl, preco: metadata.preco, loading: false }
          : d,
      ),
    );
  }

  async function promptAddLink() {
    const url = await promptText({ title: 'Adicionar link do produto', placeholder: 'https://...' });
    if (url) await addLink(url);
  }

  function updateDraft(key: number, patch: Partial<LinkDraft>) {
    setLinks((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function removeDraft(key: number) {
    setLinks((prev) => prev.filter((d) => d.key !== key));
  }

  async function salvar() {
    const nomeTrim = nome.trim();
    const qtd = Number.parseInt(quantidade, 10);
    const unidades = Number.parseInt(unidadesPorItem, 10);
    const prazoTrim = prazoGarantiaDias.trim();
    const prazo = prazoTrim === '' ? null : Number.parseInt(prazoTrim, 10);

    if (!nomeTrim) return setErro('Informe um nome');
    if (!Number.isFinite(qtd) || qtd <= 0) return setErro('Informe uma quantidade válida');
    if (!Number.isFinite(unidades) || unidades <= 0) return setErro('Informe um número de unidades válido');
    if (prazo != null && (!Number.isFinite(prazo) || prazo < 0)) return setErro('Prazo de garantia inválido');
    setErro(null);
    setSaving(true);

    let resolvedItemId: number;
    if (isEdit) {
      resolvedItemId = itemId!;
      await updateItemFields(resolvedItemId, {
        nomeSimplificado: nomeTrim,
        categoriaId,
        quantidade: qtd,
        unidadesPorItem: unidades,
        prazoGarantiaDias: prazo,
      });
      const existingIds = new Set((await getLinksForItem(resolvedItemId)).map((l) => l.id));
      const keptIds = new Set(links.map((d) => d.id).filter((id): id is number => id != null));
      for (const removedId of existingIds) {
        if (removedId != null && !keptIds.has(removedId)) await deleteLink(removedId);
      }
    } else {
      resolvedItemId = await insertItem({
        listaId: listId,
        nomeSimplificado: nomeTrim,
        categoriaId,
        quantidade: qtd,
        unidadesPorItem: unidades,
        prazoGarantiaDias: prazo,
      });
    }

    for (const draft of links) {
      if (draft.id != null) {
        await updateLink(draft.id, {
          url: draft.url,
          loja: draft.loja,
          imagemUrl: draft.imagemUrl,
          preco: draft.preco,
          escolhido: draft.escolhido,
        });
      } else {
        await insertLink({
          itemId: resolvedItemId,
          url: draft.url,
          loja: draft.loja,
          imagemUrl: draft.imagemUrl,
          preco: draft.preco,
          escolhido: draft.escolhido,
        });
      }
    }

    onBack();
  }

  return (
    <div class="screen">
      <header class="appbar">
        <button class="icon-btn appbar-back" aria-label="Voltar" onClick={onBack}>
          ←
        </button>
        <h1>{isEdit ? 'Editar item' : 'Novo item'}</h1>
      </header>
      <div class="screen-body">
        {loadingExisting ? (
          <div class="centered">Carregando…</div>
        ) : (
          <div class="form">
            <label class="field">
              <span>Nome simplificado</span>
              <input placeholder="ex: cinto marrom" value={nome} onInput={(e) => setNome((e.target as HTMLInputElement).value)} />
            </label>

            <label class="field">
              <span>Categoria</span>
              <select
                value={categoriaId ?? ''}
                onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  setCategoriaId(v === '' ? null : Number(v));
                }}
              >
                <option value="">Sem categoria</option>
                {categorias?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icone ? `${c.icone} ` : ''}
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>

            <div class="field-row">
              <label class="field">
                <span>Quantidade</span>
                <input
                  type="number"
                  value={quantidade}
                  onInput={(e) => setQuantidade((e.target as HTMLInputElement).value)}
                />
              </label>
              <label class="field">
                <span>Unidades por item</span>
                <input
                  type="number"
                  value={unidadesPorItem}
                  onInput={(e) => setUnidadesPorItem((e.target as HTMLInputElement).value)}
                />
                <small>ex: Kit com 2 → 2</small>
              </label>
            </div>

            <label class="field">
              <span>Prazo de garantia (dias)</span>
              <input
                type="number"
                value={prazoGarantiaDias}
                onInput={(e) => setPrazoGarantiaDias((e.target as HTMLInputElement).value)}
              />
              <small>Opcional — usado ao marcar como comprado</small>
            </label>

            {erro && <p class="field-error">{erro}</p>}

            <div class="field-row-header">
              <span class="section-label">Links do produto</span>
              <button class="btn-text" onClick={promptAddLink}>
                ＋ Adicionar link
              </button>
            </div>

            {links.map((draft) => (
              <LinkCard
                key={draft.key}
                draft={draft}
                onPrecoChange={(v) => updateDraft(draft.key, { preco: v })}
                onRemove={() => removeDraft(draft.key)}
              />
            ))}

            <button class="btn-filled btn-block" disabled={saving} onClick={salvar}>
              {saving ? 'Salvando…' : 'Salvar item'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LinkCard({
  draft,
  onPrecoChange,
  onRemove,
}: {
  draft: LinkDraft;
  onPrecoChange: (preco: number | null) => void;
  onRemove: () => void;
}) {
  return (
    <div class="card link-card">
      {draft.imagemUrl ? (
        <img class="link-thumb" src={draft.imagemUrl} alt="" />
      ) : (
        <div class="link-thumb link-thumb--placeholder">🔗</div>
      )}
      <div class="link-card-main">
        <div class="chip-row">
          <span class="chip">{storeLabel(draft.loja)}</span>
          {draft.loading && <span class="spinner-inline" />}
        </div>
        {draft.tituloOriginal && <div class="link-title">{draft.tituloOriginal}</div>}
        <label class="field">
          <span>Preço (R$)</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.preco?.toFixed(2) ?? ''}
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value.replace(',', '.');
              onPrecoChange(v.trim() === '' ? null : Number.parseFloat(v));
            }}
          />
        </label>
      </div>
      <button class="icon-btn" aria-label="Remover link" onClick={onRemove}>
        🗑
      </button>
    </div>
  );
}
