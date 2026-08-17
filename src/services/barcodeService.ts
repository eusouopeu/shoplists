export function barcodeDetectionSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

/** Consulta a Open Food Facts (base pública, sem autenticação, com CORS
 * liberado) para tentar obter o nome do produto a partir do código de
 * barras (EAN/UPC). Retorna null se não encontrar ou se offline. */
export async function lookupProductByBarcode(code: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const nome: unknown = data?.product?.product_name_pt || data?.product?.product_name;
    return typeof nome === 'string' && nome.trim() ? nome.trim() : null;
  } catch {
    return null;
  }
}
