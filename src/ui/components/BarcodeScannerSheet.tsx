import { useEffect, useRef, useState } from 'preact/hooks';
import { barcodeDetectionSupported, lookupProductByBarcode } from '../../services/barcodeService';
import { Centered, PrimaryButton, TextButton } from '../kit';
import { openSheet } from '../overlay';

export interface BarcodeScanResult {
  codigo: string;
  nome: string | null;
}

export function openBarcodeScannerSheet(): Promise<BarcodeScanResult | undefined> {
  return openSheet<BarcodeScanResult>((close) => <BarcodeScannerForm close={close} />);
}

type Stage = 'scanning' | 'looking-up' | 'unsupported' | 'error';

function BarcodeScannerForm({ close }: { close: (result?: BarcodeScanResult) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stage, setStage] = useState<Stage>(barcodeDetectionSupported() ? 'scanning' : 'unsupported');
  const [codigo, setCodigo] = useState<string | null>(null);

  useEffect(() => {
    if (stage !== 'scanning') return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let rafId: number;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
        });
        const loop = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) {
              await onDetected(results[0].rawValue);
              return;
            }
          } catch {
            // frame ilegível — tenta de novo no próximo
          }
          rafId = requestAnimationFrame(() => void loop());
        };
        rafId = requestAnimationFrame(() => void loop());
      } catch {
        if (!stopped) setStage('error');
      }
    }

    async function onDetected(value: string) {
      stopped = true;
      setCodigo(value);
      setStage('looking-up');
      const nome = await lookupProductByBarcode(value);
      close({ codigo: value, nome });
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  return (
    <div class="flex flex-col gap-4 p-5">
      <h3 class="m-0 text-lg font-bold">Escanear código de barras</h3>
      {stage === 'scanning' && (
        <>
          <div class="overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} class="aspect-square w-full object-cover" muted playsInline />
          </div>
          <p class="m-0 text-center text-[0.85rem] text-text-muted">Aponte a câmera para o código de barras do produto.</p>
        </>
      )}
      {stage === 'looking-up' && (
        <Centered>
          <div>
            <div>Código lido: {codigo}</div>
            <div class="mt-1 text-[0.85rem] text-text-muted">Buscando nome do produto…</div>
          </div>
        </Centered>
      )}
      {stage === 'unsupported' && (
        <p class="m-0 text-[0.85rem] text-text-muted">
          Este navegador/dispositivo não suporta leitura de código de barras. Digite o nome manualmente.
        </p>
      )}
      {stage === 'error' && (
        <p class="m-0 text-[0.85rem] text-danger">
          Não foi possível acessar a câmera. Verifique a permissão de câmera do app.
        </p>
      )}
      <div class="flex justify-end gap-2">
        <TextButton onClick={() => close(undefined)}>Cancelar</TextButton>
        {stage === 'error' && <PrimaryButton onClick={() => setStage('scanning')}>Tentar de novo</PrimaryButton>}
      </div>
    </div>
  );
}
