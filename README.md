# Loyalty Cards

A self-hosted PWA that keeps your loyalty cards on your phone. Add cards by scanning the barcode with the camera (or typing the number), and they are shown as tappable tiles with the barcode ready to scan at checkout.

- Frontend: vanilla JS + Vite, installable as a PWA on iOS/Android
- Backend: small Express server
- Data: single `cards.json` file stored in a Docker volume (single user, no auth)

## Quick start (local)

```sh
    npm install
    npm run build
    npm start          # serves http://localhost:3000
```

For development with hot reload:

```sh
    npm run dev        # frontend on :5173, proxies /api to :3000
    # in another terminal:
    npm start
```

Data is stored in `./data/cards.json` by default. Override with `DATA_DIR` or `PORT`:

```sh
    DATA_DIR=/var/lib/loyalty PORT=8080 npm start
```

> Camera scanning requires a secure context (HTTPS or `localhost`). On a phone, open the app over `https://` — otherwise use manual entry.

## Deploy with Docker

### Build and run

```sh
    docker compose up -d --build
```

The app is available at `http://<server-ip>:8080`.

### Rebuild after changes

```sh
    docker compose up -d --build
```

### Stop / remove

```sh
    docker compose down            # stop, keep data volume
    docker compose down -v         # stop and delete stored cards
```

## Configuration

| Variable   | Default | Description                       |
|------------|---------|-----------------------------------|
| `PORT`     | `3000`  | Port the server listens on        |
| `DATA_DIR` | `/data` | Directory containing `cards.json` |

The compose file maps host port `8080` to the container and mounts the named volume `loyalty-cards-data` at `/data`, so your cards survive container rebuilds.

## Install on iOS / Android

1. Open the app in Safari/Chrome
2. iOS: tap **Share** → **Add to Home Screen** → **Add**
3. Android: tap the browser menu → **Add to Home screen** / **Install app**

Open it from the home screen like a native app.

## Notes

- Cards are stored as `cards.json` in the volume — back it up alongside your other data.
- Single-user: the app assumes only you use it and adds no authentication. Expose it on a trusted network only.
- Barcode formats: QR, EAN-8/13, UPC-A/E, Code 128/39/93, ITF, Codabar.
