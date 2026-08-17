/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// BarcodeDetector ainda não está no lib.dom.d.ts do TypeScript (API recente,
// suportada no Chromium/WebView Android usado pelo Capacitor).
interface BarcodeDetectorOptions {
  formats?: string[];
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
