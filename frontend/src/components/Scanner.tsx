import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
export function Scanner({
  onRead,
  onClose,
}: {
  onRead: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const start = async () => {
      try {
        const Detector = (window as any).BarcodeDetector;
        if (!Detector)
          throw new Error(
            'Este navegador não oferece leitura por câmera. Use um leitor USB ou digite o código no formulário.',
          );
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current!.srcObject = stream;
        await video.current!.play();
        const detector = new Detector({ formats: ['code_128', 'ean_13', 'ean_8', 'qr_code'] });
        const scan = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video.current);
            if (codes.length) {
              onRead(codes[0].rawValue);
              return;
            }
          } catch {
            /* retry frame */
          }
          timer = setTimeout(scan, 250);
        };
        await scan();
      } catch (e) {
        setError((e as Error).message);
      }
    };
    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onRead]);
  return (
    <Modal title="Ler código de barras" onClose={onClose}>
      <p>Aponte a câmera para a etiqueta do material.</p>
      {error ? (
        <p className="error-box" role="alert">
          {error}
        </p>
      ) : (
        <video ref={video} muted playsInline className="scanner-video" />
      )}
    </Modal>
  );
}
