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

export function startScanner(videoEl, onResult, onError) {
  const reader = new BrowserMultiFormatReader();
  let controls = null;
  let stopped = false;

  const callback = (result) => {
    if (stopped) return;
    if (result) {
      const text = result.getText();
      const format = formatName(result.getBarcodeFormat());
      if (text) {
        stop();
        onResult({ text, format });
      }
    }
  };

  function stop() {
    stopped = true;
    if (controls) {
      try {
        controls.stop();
      } catch {
        /* ignore */
      }
    }
  }

  reader
    .decodeFromConstraints({ audio: false, video: { facingMode: 'environment' } }, videoEl, callback)
    .then((c) => {
      controls = c;
      if (stopped) stop();
    })
    .catch((err) => {
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
