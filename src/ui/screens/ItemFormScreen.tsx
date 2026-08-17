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
import { openBarcodeScannerSheet } from '../components/BarcodeScannerSheet';
import { promptText } from '../components/PromptDialog';
import { IconArrowLeft, IconLink, IconQrCode, IconTrash } from '../icons';
import {
  AppBar,
  AppBarTitle,
  Centered,
  Chip,
  Field,
  FieldError,
  IconButton,
  PrimaryButton,
  ScreenBody,
  SectionLabel,
  Screen,
  Select,
  Spinner,
  TextButton,
  TextInput,
} from '../kit';

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

  async function scanBarcode() {
    const result = await openBarcodeScannerSheet();
    if (result?.nome && !nome.trim()) setNome(result.nome);
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
    <Screen>
      <AppBar>
        <IconButton label="Voltar" variant="header" onClick={onBack}>
          <IconArrowLeft size={22} />
        </IconButton>
        <AppBarTitle>{isEdit ? 'Editar item' : 'Novo item'}</AppBarTitle>
      </AppBar>
      <ScreenBody>
        {loadingExisting ? (
          <Centered>Carregando…</Centered>
        ) : (
          <div class="flex flex-col gap-4">
            <div class="flex items-end gap-2">
              <div class="flex-1">
                <Field label="Nome simplificado">
                  <TextInput
                    placeholder="ex: cinto marrom"
                    value={nome}
                    onInput={(e) => setNome((e.target as HTMLInputElement).value)}
                  />
                </Field>
              </div>
              <IconButton label="Escanear código de barras" onClick={scanBarcode} class="mb-0.5 border border-border">
                <IconQrCode size={22} />
              </IconButton>
            </div>

            <Field label="Categoria">
              <Select
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
              </Select>
            </Field>

            <div class="flex gap-3">
              <div class="flex-1">
                <Field label="Quantidade">
                  <TextInput
                    type="number"
                    value={quantidade}
                    onInput={(e) => setQuantidade((e.target as HTMLInputElement).value)}
                  />
                </Field>
              </div>
              <div class="flex-1">
                <Field label="Unidades por item" hint="ex: Kit com 2 → 2">
                  <TextInput
                    type="number"
                    value={unidadesPorItem}
                    onInput={(e) => setUnidadesPorItem((e.target as HTMLInputElement).value)}
                  />
                </Field>
              </div>
            </div>

            <Field label="Prazo de garantia (dias)" hint="Opcional — usado ao marcar como comprado">
              <TextInput
                type="number"
                value={prazoGarantiaDias}
                onInput={(e) => setPrazoGarantiaDias((e.target as HTMLInputElement).value)}
              />
            </Field>

            {erro && <FieldError>{erro}</FieldError>}

            <div class="mt-2 flex items-center justify-between">
              <SectionLabel>Links do produto</SectionLabel>
              <TextButton onClick={promptAddLink}>＋ Adicionar link</TextButton>
            </div>

            {links.map((draft) => (
              <LinkCard
                key={draft.key}
                draft={draft}
                onPrecoChange={(v) => updateDraft(draft.key, { preco: v })}
                onRemove={() => removeDraft(draft.key)}
              />
            ))}

            <PrimaryButton block disabled={saving} onClick={salvar}>
              {saving ? 'Salvando…' : 'Salvar item'}
            </PrimaryButton>
          </div>
        )}
      </ScreenBody>
    </Screen>
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
    <div class="mb-2.5 flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-3.5 shadow-sm">
      {draft.imagemUrl ? (
        <img class="h-14 w-14 shrink-0 rounded-lg object-cover" src={draft.imagemUrl} alt="" />
      ) : (
        <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted">
          <IconLink size={22} />
        </div>
      )}
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex items-center gap-2">
          <Chip>{storeLabel(draft.loja)}</Chip>
          {draft.loading && <Spinner />}
        </div>
        {draft.tituloOriginal && (
          <div class="line-clamp-2 text-[0.85rem] text-text-muted">{draft.tituloOriginal}</div>
        )}
        <Field label="Preço (R$)">
          <TextInput
            type="text"
            inputMode="decimal"
            value={draft.preco?.toFixed(2) ?? ''}
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value.replace(',', '.');
              onPrecoChange(v.trim() === '' ? null : Number.parseFloat(v));
            }}
          />
        </Field>
      </div>
      <IconButton label="Remover link" onClick={onRemove}>
        <IconTrash size={18} />
      </IconButton>
    </div>
  );
}
