import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

interface DragReorderOptions<T> {
  items: T[];
  getId: (item: T) => number;
  onDrop: (orderedIds: number[]) => void;
}

interface DragReorderResult<T> {
  orderedItems: T[];
  draggingId: number | null;
  containerRef: (el: HTMLDivElement | null) => void;
  handleProps: (id: number) => {
    onPointerDown: (e: PointerEvent) => void;
  };
}

/** Reordenação por arraste com Pointer Events puros (sem libs), funciona com
 * mouse e touch. A alça (`handleProps`) inicia o arraste; o item troca de
 * posição sempre que o ponteiro cruza o meio do vizinho. */
export function useDragReorder<T>({ items, getId, onDrop }: DragReorderOptions<T>): DragReorderResult<T> {
  const [order, setOrder] = useState<T[]>(items);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<number | null>(null);

  useEffect(() => {
    if (draggingRef.current == null) setOrder(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const reorder = useMemo(
    () => (id: number, clientY: number) => {
      const container = containerElRef.current;
      if (!container) return;
      const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-drag-id]'));
      let targetIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const rect = rows[i].getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex === -1) targetIndex = rows.length - 1;

      setOrder((prev) => {
        const fromIndex = prev.findIndex((item) => getId(item) === id);
        if (fromIndex === -1 || fromIndex === targetIndex) return prev;
        const next = prev.slice();
        const [moved] = next.splice(fromIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    },
    [getId],
  );

  function handlePointerDown(id: number, e: PointerEvent) {
    e.preventDefault();
    draggingRef.current = id;
    setDraggingId(id);

    const onMove = (ev: PointerEvent) => reorder(id, ev.clientY);
    const onUp = () => {
      draggingRef.current = null;
      setDraggingId(null);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      setOrder((current) => {
        onDrop(current.map(getId));
        return current;
      });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }

  return {
    orderedItems: order,
    draggingId,
    containerRef: (el) => {
      containerElRef.current = el;
    },
    handleProps: (id) => ({
      onPointerDown: (e: PointerEvent) => handlePointerDown(id, e),
    }),
  };
}
