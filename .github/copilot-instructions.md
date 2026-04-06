# Copilot Instructions

## Architecture

This is a **Power Apps Component Framework (PCF)** control that provides a voice-enabled chat UI for Microsoft Copilot Studio, deployed as part of a Dynamics 365 Canvas App ("Outside Sales Agent"). The repo contains three independent TypeScript projects plus Azure infrastructure.

### PCF Control (`CopilotChatDirectLine/`)
The main project. A React-based PCF control with two active variants built from the same `package.json`:

- **CopilotChatBeta/** — Active development (v2.0.9). Has all features: voice I/O, adaptive cards, driving mode, multi-language (34 languages), admin/debug panel, file attachments.
- **CopilotChatGA/** — Stable release. Same file structure as Beta but fewer features.
- **CopilotVisionChat/** — Camera/vision variant (beta, incomplete).

Both Beta and GA share identical component architecture:
```
index.ts              → PCF lifecycle (init/updateView/destroy), renders Control via ReactDOM
src/Control.tsx       → Root React component, initializes CopilotChatService, manages connection state
src/ChatWindow.tsx    → Main chat UI (messages, input, settings panel, speech controls)
src/services/
  CopilotChatService.ts  → Direct Line REST API client (polling-based, not WebSocket)
  EntraAuthService.ts    → Entra ID OAuth 2.0 with PKCE for SSO
src/utils/
  auth.ts                → Direct Line token helper
  storage.ts             → localStorage persistence for conversation state, settings, messages
src/useSpeak.ts          → TTS hook (browser SpeechSynthesis, Azure Neural, or OpenAI via proxy)
src/useAttachments.ts    → File/photo attachment hook
src/useDebugLog.tsx      → Debug logging panel hook + DebugPanel component
src/useThinkingSound.ts  → Audio feedback while bot is processing
src/languages.ts         → 34-language config with BCP-47 codes and Azure voice mappings
src/AdaptiveCardRenderer.tsx → Renders Adaptive Cards from bot responses
src/DrivingModeModal.tsx     → Hands-free voice-only modal
src/AttachmentPreview.tsx    → Image/file preview before sending
```

### Azure Functions (`azure-functions/`)
Two independent Azure Function v4 projects (Node.js/TypeScript):

- **speech-proxy/** — TTS proxy using `DefaultAzureCredential` (managed identity). Endpoints: `POST /api/azure-tts`, `POST /api/openai-tts`. Shared auth/CORS in `src/shared.ts`.
- **vision-proxy/** — Vision API proxy for camera/image analysis.

### Token Exchange (`TokenExchangeFunction/`)
Azure Function for Copilot Studio SSO token exchange. Validates Entra ID tokens using `jsonwebtoken` and `jwks-rsa`. Enables seamless SSO on Power Apps Mobile (no sign-in prompts). Configured in Copilot Studio under Settings → Security → Token exchange URL.

### Azure Infrastructure
- `azuredeploy.json` + `azuredeploy.parameters.json` — ARM template deploying 11 resources (Speech Service, OpenAI, Function App, RBAC assignments, App Insights, etc.)
- `app-api-config.json` — Entra ID OAuth2 scope definition (`access_as_user`)

### Power Platform Solutions (`CopilotChatDirectLine/Solutions/`)
Three solution projects:
- **CopilotChatBetaSolution** — Beta PCF control solution
- **CopilotChatGASolution** — GA PCF control solution
- **D365MobileCanvasTemplate** — Turnkey solution with Canvas App, Copilot Studio Agent, Custom Pages, 22 Cloud Flows, and all PCF controls

## Build & Deploy

### PCF Control
```bash
cd CopilotChatDirectLine
npm install
npm run build          # Compile TypeScript + bundle via pcf-scripts
npm run start          # Launch PCF test harness
npm run start:watch    # Test harness with hot reload
npm run lint           # ESLint (flat config with typescript-eslint + Power Apps plugin)
npm run lint:fix       # Auto-fix lint issues
```

Full deployment to Power Platform:
```bash
cd CopilotChatDirectLine
npm run build
dotnet build CopilotChatBeta.pcfproj /p:Configuration=Release
cd Solutions/CopilotChatBetaSolution
dotnet build /p:Configuration=Release
pac solution import --path bin/Release/CopilotChatBetaSolution.zip --force-overwrite --publish-changes
```

Clean build (when artifacts cause issues):
```powershell
Remove-Item CopilotChatBeta\out -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item Solutions\CopilotChatBetaSolution\obj -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item Solutions\CopilotChatBetaSolution\bin -Recurse -Force -ErrorAction SilentlyContinue
```

### Azure Functions (speech-proxy, vision-proxy, TokenExchangeFunction)
Each is an independent project:
```bash
cd azure-functions/speech-proxy   # or vision-proxy, or TokenExchangeFunction
npm install
npm run build    # tsc
npm run start    # func start (requires Azure Functions Core Tools)
```

### Speech Proxy Deployment
```powershell
cd azure-functions/speech-proxy
npm install && npm run build
Compress-Archive -Path host.json, package.json, package-lock.json, dist, node_modules -DestinationPath deploy.zip -Force
az functionapp deployment source config-zip --name "<functionAppName>" --resource-group "<rgName>" --src deploy.zip
```

## Key Conventions

### Publisher & Naming
- **Publisher**: `BillWhalenSolutionEngineering`, prefix `bw`, customization option value prefix `94067`
- All Power Platform Environment Variables use the `bw_` prefix (e.g., `bw_DirectLineSecret`, `bw_SpeechProxyEndpoint`)
- The publisher must match what's already deployed to the target environment for solution upgrades to work

### Version Synchronization (Critical)
When releasing a new version, these four files must have matching version numbers:
1. `CopilotChatBeta/ControlManifest.Input.xml` — `version` attribute + `ControlVersion` property default-value
2. `Solutions/CopilotChatBetaSolution/src/Other/Solution.xml` — `<Version>` element (must be higher than currently installed)
3. `CopilotChatBeta/index.ts` — version string in `getOutputs()`
4. `CopilotChatBeta/src/Control.tsx` — `ControlProps` interface must match manifest properties

### Property Sync Rule
**Every property in `ControlManifest.Input.xml` must have a matching entry in the `ControlProps` interface in `Control.tsx`.** If they are out of sync, the control crashes with "This app ran into a problem."

### TypeScript Configuration
- Target: ES2020, Module: ESNext, JSX: react
- Strict mode enabled (`strict`, `noImplicitAny`, `strictNullChecks`)
- `noUnusedLocals` and `noUnusedParameters` are disabled
- React 16.8.6 (class-free, hooks-based but uses legacy `ReactDOM.render`)

### React Patterns
- Functional components with hooks throughout (no class components)
- Custom hooks for cross-cutting concerns: `useSpeak`, `useAttachments`, `useDebugLog`, `useThinkingSound`
- State managed via `React.useState`/`React.useEffect` — no external state library
- Inline styles (no CSS modules or stylesheets) — the `@microsoft/power-apps/no-css-inline-styles` ESLint rule is disabled

### Direct Line Integration
- Uses REST polling (not WebSocket) via `CopilotChatService`
- Conversation state persisted to `localStorage` for reconnection
- Supports both Direct Line secret and Entra ID (OAuth 2.0 + PKCE) authentication
- Entra auth uses popup/redirect flow with PKCE — works on iOS Safari, Android Chrome, and all modern browsers

### Authentication Modes
- **Direct mode**: Pass `DirectLineSecret` directly (simpler, for dev/demo)
- **Entra mode**: Set `AuthMode=Entra` with `EntraClientId`, `EntraTenantId`, `EntraScope`, `BotId`. Requires an Entra App Registration with SPA redirect URIs pointing to the Dynamics 365 org URL and `isFallbackPublicClient=true`

### Sensitive Properties
Properties marked with 🔐 in the manifest (`DirectLineSecret`, `SpeechKey`, `OpenAIKey`, `SpeechProxyApiKey`) contain credentials. Never hardcode values — use Power Platform Environment Variables (prefixed `bw_`) for production.

### PR & Testing Checklist
PRs should be tested in: PCF Test Harness, Canvas App (Desktop), and Canvas App (Mobile). See `.github/PULL_REQUEST_TEMPLATE.md`.

### Scripts Directory
`scripts/` contains ~100+ Python utility scripts for Dataverse/Power Platform solution management (import debugging, entity auditing, dependency analysis). These are operational tools, not part of the build.

### Key Documentation
- `DEPLOYMENT.md` (root) — Version update checklist, build steps, troubleshooting
- `CopilotChatDirectLine/DEPLOYMENT.md` — Detailed PCF deployment, publisher info, Entra app registration setup, version history
- `TokenExchangeFunction/README.md` — SSO token exchange architecture and deployment
- `docs/COLLEAGUE_DEPLOYMENT_GUIDE.md` — Full end-to-end deployment guide (ARM → speech proxy → Power Platform → env vars → Copilot Studio)
