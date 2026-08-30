import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, BrowserQRCodeSvgWriter } from '@zxing/library';
import JsBarcode from 'jsbarcode';

const JSBARCODE_FORMATS = {
  EAN_13: 'EAN13',
  EAN_8: 'EAN8',
  UPC_A: 'UPC',
  UPC_E: 'UPC',
  CODE_128: 'CODE128',
  CODE_39: 'CODE39',
  CODE_93: 'CODE93',
  ITF: 'ITF',
  CODABAR: 'codabar'
};

export function formatName(fmt) {
  return BarcodeFormat[fmt] ?? 'UNKNOWN';
}

export function supportsCamera() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export function isSecureContext() {
  return window.isSecureContext === true;
}

const MAX_CAPTURE_WIDTH = 960;
const SCAN_INTERVAL_MS = 220;

export function startScanner(videoEl, onResult, onError) {
  const reader = new BrowserMultiFormatReader();
  let stopped = false;
  let stream = null;
  let timerId = 0;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timerId);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
  }

  function tick() {
    if (stopped) return;

    if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      const scale = Math.min(1, MAX_CAPTURE_WIDTH / vw);
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      try {
        const result = reader.decodeFromCanvas(canvas);
        if (result) {
          const text = result.getText();
          if (text) {
            stop();
            onResult({ text, format: formatName(result.getBarcodeFormat()) });
            return;
          }
        }
      } catch (e) {
        // No barcode in this frame — keep scanning.
      }
    }

    timerId = setTimeout(tick, SCAN_INTERVAL_MS);
  }

  (async () => {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'environment' }
    });
    if (stopped) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    videoEl.srcObject = stream;
    try {
      await videoEl.play();
    } catch (e) {
      // Some browsers reject play() on autoplay policy; frames still flow.
    }

    tick();
  })().catch((err) => {
    if (!stopped) {
      stopped = true;
      onError(err);
    }
  });

  return stop;
}

export function renderBarcode(container, card, { height = 80 } = {}) {
  container.replaceChildren();

  if (card.format === 'QR_CODE') {
    const width = Math.round(height * 1.6);
    const svg = new BrowserQRCodeSvgWriter().write(card.barcode, width, height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.width = '100%';
    svg.style.height = 'auto';
    container.appendChild(svg);
    return;
  }

  const jsFormat = JSBARCODE_FORMATS[card.format] || 'CODE128';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, card.barcode, {
      format: jsFormat,
      height,
      width: 2,
      margin: 8,
      displayValue: false,
      background: '#ffffff',
      lineColor: '#0f172a',
      valid: () => true
    });
    svg.setAttribute('viewBox', `0 0 ${svg.getAttribute('width')} ${svg.getAttribute('height')}`);
    svg.style.width = '100%';
    svg.style.height = 'auto';
    container.appendChild(svg);
  } catch (err) {
    const span = document.createElement('div');
    span.className = 'barcode-fallback';
    span.textContent = card.barcode;
    container.appendChild(span);
  }
}
