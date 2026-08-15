import { createWorker } from 'tesseract.js';

export interface ParsedReceiptItem {
  nome: string;
  preco: number;
  quantidade: number;
}

/** Roda OCR (português) sobre a foto/imagem de uma nota fiscal. Requer
 * rede na primeira execução (tesseract.js baixa o modelo de idioma de um
 * CDN); mesma limitação de rede já documentada para `linkMetadataService`. */
export async function recognizeReceiptText(
  image: File | Blob,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const worker = await createWorker('por', undefined, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(Math.round(m.progress * 100));
    },
  });
  try {
    const {
      data: { text },
    } = await worker.recognize(image);
    return text;
  } finally {
    await worker.terminate();
  }
}

const PRICE_RE = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
const QTY_RE = /^\s*(\d+)\s*(?:un|und|unid|x)\b/i;
const NOISE_LINE_RE =
  /^(cnpj|cpf|cupom|nfc-?e|nf-?e|valor|total|troco|dinheiro|cartao|cartão|desconto|acrescimo|subtotal|forma de pagamento|consumidor|via|item\s+cod|qtde|autorizacao|protocolo|chave|extrato|www\.|http)/i;

function toNumber(price: string): number {
  return Number(price.replace(/\./g, '').replace(',', '.'));
}

/** Extrai heuristicamente linhas "nome + preço" do texto bruto do OCR de
 * uma nota fiscal brasileira. Não é 100% confiável — o usuário revisa e
 * edita cada linha antes de confirmar a importação. */
export function parseReceiptLines(rawText: string): ParsedReceiptItem[] {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const items: ParsedReceiptItem[] = [];
  for (const line of lines) {
    if (NOISE_LINE_RE.test(line)) continue;
    const priceMatch = line.match(PRICE_RE);
    if (!priceMatch) continue;

    let rest = line.slice(0, priceMatch.index).trim();
    // remove um eventual segundo número (preço unitário) antes do total
    rest = rest.replace(/\d{1,3}(?:\.\d{3})*,\d{2}\s*$/, '').trim();
    // remove código de produto no início (sequência longa de dígitos)
    rest = rest.replace(/^\d{4,}\s*/, '').trim();

    const qtyMatch = rest.match(QTY_RE);
    const quantidade = qtyMatch ? Math.max(1, Number(qtyMatch[1])) : 1;
    if (qtyMatch) rest = rest.slice(qtyMatch[0].length).trim();
    rest = rest.replace(/^[-x:]\s*/i, '').trim();

    const preco = toNumber(priceMatch[1]);
    if (!rest || rest.length < 2 || !Number.isFinite(preco) || preco <= 0) continue;

    items.push({ nome: rest, preco, quantidade });
  }
  return items;
}
