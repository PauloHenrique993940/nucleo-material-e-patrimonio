import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { Modal } from './Modal';
export function Scanner({
  onRead,
  onClose,
}: {
  onRead: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const read = useRef(onRead);
  read.current = onRead;
  const [error, setError] = useState('');
  useEffect(() => {
    let controls: IScannerControls | undefined;
    let stopped = false;
    let lastCode = '';
    let lastRead = 0;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            'Para usar a câmera do celular, abra o sistema por HTTPS e permita o acesso à câmera.',
          );
        controls = await new BrowserMultiFormatReader().decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          video.current!,
          (result) => {
            if (stopped || !result) return;
            const code = result.getText();
            if (code === lastCode && Date.now() - lastRead < 3000) return;
            lastCode = code;
            lastRead = Date.now();
            read.current(code);
          },
        );
        if (stopped) controls.stop();
      } catch (e) {
        if (!stopped)
          setError(
            (e as Error).name === 'NotAllowedError'
              ? 'Permita o acesso à câmera nas configurações do navegador e tente novamente.'
              : (e as Error).message,
          );
      }
    };
    void start();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);
  return (
    <Modal title="Ler QR Code ou código de barras" onClose={onClose}>
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
