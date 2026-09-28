# KMOU graduation checker deployment source bundle

This ZIP contains deployment source code and configuration. It does not include built output, dependencies, test fixtures, model weights, or a model server. Supply and run local LLM model files and servers separately.

## Node.js on the host

Use Node.js 24.18.0 and npm. Extract the ZIP and run from `kmou-grad-check/`:

```sh
npm ci --ignore-scripts
cp .env.example .env.local
npm run build
npm start
```

Set `.env.local` for your local model servers, for example:

```dotenv
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=http://127.0.0.1:18081
LLM_MODEL=qwen3-4b
LLM_LARGE_BASE_URL=http://127.0.0.1:18082
LLM_LARGE_MODEL=qwen3-8b
```

## Docker Compose

From `kmou-grad-check/`, create a local `.env` file with settings such as:

```dotenv
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=http://kmou-qwen-4b:8080
LLM_MODEL=qwen3-4b
LLM_LARGE_BASE_URL=http://kmou-qwen-8b:8080
LLM_LARGE_MODEL=qwen3-8b
```

The example Docker hostnames require separately running model services on the same Docker network. Then run `docker compose up --build -d`. For a host Ollama server, see `README.md` and `.env.example`. The app is available at http://localhost:3000; health check: http://localhost:3000/api/health. Never copy real keys or private `.env` files into the bundle.

The `npm test` command in README.md requires separately retained test fixtures; tests are intentionally excluded from this deployment bundle. See README.md and README_SETUP.md for further setup details.
