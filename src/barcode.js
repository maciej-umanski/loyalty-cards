import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, BrowserQRCodeSvgWriter, NotFoundException, ChecksumException, FormatException } from '@zxing/library';
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
const SCAN_INTERVAL_MS = 200;

export function startScanner(videoEl, onResult, onError, onState) {
  const reader = new BrowserMultiFormatReader();
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

    if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      const scale = Math.min(1, MAX_CAPTURE_WIDTH / vw);
      canvas.width = Math.max(1, Math.round(vw * scale));
      canvas.height = Math.max(1, Math.round(vh * scale));
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      try {
        const result = reader.decodeFromCanvas(canvas);
        if (result && result.getText()) {
          stop();
          onResult({ text: result.getText(), format: formatName(result.getBarcodeFormat()) });
          return;
        }
      } catch (e) {
        if (e instanceof NotFoundException || e instanceof ChecksumException || e instanceof FormatException) {
          // No code (or partial) in this frame — keep scanning.
        } else {
          stop();
          onError(e);
          return;
        }
      }
    }

    timerId = setTimeout(loop, SCAN_INTERVAL_MS);
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
      // Fallback: some devices reject the ideal constraints.
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
    if (stopped) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    videoEl.srcObject = stream;
    await new Promise((resolve) => {
      if (videoEl.readyState >= 1) return resolve();
      videoEl.addEventListener('loadedmetadata', resolve, { once: true });
    });
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
