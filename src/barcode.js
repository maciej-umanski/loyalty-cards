import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, BrowserQRCodeSvgWriter, DecodeHintType, NotFoundException, ChecksumException, FormatException } from '@zxing/library';
import JsBarcode from 'jsbarcode';
import pdf417gen from 'pdf417-generator';

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
const SCAN_INTERVAL_MS = 200;

const SCAN_FORMATS = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.PDF_417
];

const SCAN_HINTS = new Map();
SCAN_HINTS.set(DecodeHintType.POSSIBLE_FORMATS, SCAN_FORMATS);

export function startScanner(videoEl, onResult, onError, onState) {
  const reader = new BrowserMultiFormatReader(SCAN_HINTS);
  let stopped = false;
  let stream = null;
  let timerId = 0;
  let noFrameTimer = 0;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const report = (msg) => {
    if (onState) onState(msg);
  };

  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timerId);
    clearTimeout(noFrameTimer);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (videoEl) {
      videoEl.pause();
      videoEl.srcObject = null;
    }
  }

  function loop() {
    if (stopped) return;
    let found = false;

    try {
      if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
        const vw = videoEl.videoWidth;
        const vh = videoEl.videoHeight;
        const scale = Math.min(1, MAX_CAPTURE_WIDTH / vw);
        canvas.width = Math.max(1, Math.round(vw * scale));
        canvas.height = Math.max(1, Math.round(vh * scale));
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const result = reader.decodeFromCanvas(canvas);
        if (result && result.getText()) {
          found = true;
          stop();
          onResult({ text: result.getText(), format: formatName(result.getBarcodeFormat()) });
        }
      }
    } catch (e) {
      const errName = e && (e.name || (e.constructor && e.constructor.name));
      if (
        errName === 'NotFoundException' ||
        errName === 'ChecksumException' ||
        errName === 'FormatException' ||
        e instanceof NotFoundException ||
        e instanceof ChecksumException ||
        e instanceof FormatException
      ) {
        // No code (or partial) in this frame — keep scanning.
      } else {
        stop();
        onError(e);
        return;
      }
    }

    if (!found) timerId = setTimeout(loop, SCAN_INTERVAL_MS);
  }

  (async () => {
    report('Requesting camera\u2026');
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
    if (stopped) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    videoEl.srcObject = stream;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');

    try {
      await videoEl.play();
    } catch (e) {
      report('Play failed: ' + (e && e.message ? e.message : e));
    }

    report('Camera on \u2014 point at barcode');
    noFrameTimer = setTimeout(() => {
      if (!stopped && videoEl.videoWidth === 0) {
        stop();
        onError(new Error('Camera connected but no video frames were received.'));
      }
    }, 6000);

    loop();
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

  if (card.format === 'PDF_417') {
    const canvas = document.createElement('canvas');
    try {
      pdf417gen.PDF417.draw(card.barcode, canvas, 2, -1, undefined, '#0f172a');
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.background = '#ffffff';
      container.appendChild(canvas);
    } catch (err) {
      const span = document.createElement('div');
      span.className = 'barcode-fallback';
      span.textContent = card.barcode;
      container.appendChild(span);
    }
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