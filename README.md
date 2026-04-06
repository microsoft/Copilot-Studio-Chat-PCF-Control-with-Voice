# Copilot Studio Chat PCF Control with Voice

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Power Platform](https://img.shields.io/badge/Power%20Platform-PCF-purple.svg)](https://docs.microsoft.com/en-us/powerapps/developer/component-framework/overview)

> ⚠️ **DISCLAIMER**: This repository is provided for **demonstration and educational purposes only**. It is not an officially supported Microsoft product. Use of this code is at your own risk. Microsoft makes no warranties, express or implied, and assumes no liability for any issues arising from the use of this repository in production environments.

A Power Apps Component Framework (PCF) control that enables rich, voice-enabled chat experiences with Microsoft Copilot Studio — packaged as a complete **Outside Sales Agent** solution for Dynamics 365.

## Features

- ✅ **Modern Chat UI** — Clean, responsive chat interface built with Fluent Design
- ✅ **Voice Input** — Speech-to-text using browser Web Speech API or Azure Speech Services
- ✅ **Voice Output** — Text-to-speech with Azure Neural Voices or OpenAI TTS
- ✅ **Speech Proxy** — Azure Function proxy with managed identity (no API keys in the browser)
- ✅ **Adaptive Cards** — Support for rich interactive cards from Copilot Studio
- ✅ **Mobile Support** — Works on iOS, Android, and desktop browsers
- ✅ **Direct Line Integration** — Connects to Copilot Studio via Direct Line API
- ✅ **Driving Mode** — Hands-free operation for field workers (Beta)
- ✅ **Multi-Language Support** — 34 languages with native Azure Neural voices (Beta)
- ✅ **Admin/Debug Mode** — In-app debug logging panel for troubleshooting (Beta)

---

## 🚀 Quick Deploy (Recommended)

The fastest way to deploy is using the **pre-built deployment package** — no local tools required. Everything runs from a web browser using the Azure Portal and Power Platform.

### What's in the Package

| File | Description |
|------|-------------|
| `D365MobileCanvasTemplate_1.2.0.zip` | Power Platform solution — Canvas App + Copilot Studio Agent + Cloud Flows + PCF Controls |
| `azuredeploy.json` | ARM template — deploys Azure Speech Proxy stack (Function App, Speech, OpenAI, RBAC) |
| `azuredeploy.parameters.json` | ARM parameters file |
| `speech-proxy/` | Azure Function source code + pre-built output for the TTS proxy |
| `DEPLOYMENT_GUIDE.html` | Full step-by-step deployment guide (open in browser) |

**Download:** `OutsideSalesAgent-DeployPackage-v7.zip` from [Releases](../../releases) or the `CopilotChatDirectLine/Solutions/D365MobileCanvasTemplate/` folder.

### Prerequisites (browser-based — no local installs needed)

- Azure subscription with **Contributor** + **User Access Administrator** on a resource group
- Power Apps environment with **Dynamics 365 Sales** installed
- **System Administrator** or **System Customizer** security role in D365
- PCF controls enabled in the environment (Admin Center → Settings → Features → *Allow publishing of canvas apps with code components*)

### Steps

1. **Deploy Azure** — Open `azuredeploy.json` in Azure Portal → Deploy (creates Speech, OpenAI, Function App with managed identity)
2. **Deploy Function App** — Upload `speech-proxy/` to the Function App via Azure Portal → Deployment Center
3. **Import Solution** — Go to [make.powerapps.com](https://make.powerapps.com) → Solutions → Import → select `D365MobileCanvasTemplate_1.2.0.zip`
4. **Set Environment Variables** — Fill in the values prompted during import (see table below)
5. **Publish** — Click Publish All Customizations

> 📖 For detailed instructions including screenshots, open `DEPLOYMENT_GUIDE.html` from the package.

---

## Environment Variables Reference

The solution ships with **25 pre-configured environment variables**. Most have sensible defaults — you only need to fill in a few during import.

### Always Required

| Variable | Default | Description |
|----------|---------|-------------|
| `Direct Line Secret` | *(none)* | 🔐 From Copilot Studio: Settings → Channels → Direct Line → copy Secret key |
| `Dataverse URL` | *(none)* | Your org URL, e.g. `https://orgXXXXXX.crm.dynamics.com` |
| `Direct Line Endpoint` | `https://directline.botframework.com/v3/directline` | Pre-filled — leave as-is unless using a custom endpoint |

### Required for Voice — Option A: Speech Proxy (Recommended)

Uses Azure managed identity — no API keys stored in the app.

| Variable | Default | Description |
|----------|---------|-------------|
| `Speech Proxy Endpoint` | *(none)* | Your Speech Proxy Function App URL, e.g. `https://func-speech-proxy-xxx.azurewebsites.net` |
| `Speech Proxy API Key` | *(none)* | 🔐 From Azure Portal: Function App → App keys → copy default key |

### Required for Voice — Option B: Direct API Keys (Legacy)

Use if Option A is not available.

| Variable | Description |
|----------|-------------|
| `Azure Speech Key` | 🔐 Azure Speech resource → Keys and Endpoint → Key 1 |
| `Azure Speech Region` | Region code, e.g. `eastus` |
| `Azure OpenAI Endpoint` | Azure OpenAI resource endpoint URL |
| `Azure OpenAI Key` | 🔐 Azure OpenAI → Keys and Endpoint → Key 1 |
| `Azure OpenAI TTS Deployment` | Deployment name for TTS model (e.g. `tts`) |

### Optional — Copilot Studio Agent

| Variable | Default | Description |
|----------|---------|-------------|
| `Copilot Studio Endpoint` | `https://directline.botframework.com` | Override only for custom/regional endpoints |
| `Copilot Studio Bot ID` | *(none)* | Bot Schema Name — only needed when A2A routing is enabled |
| `Copilot Studio Tenant ID` | *(none)* | Tenant GUID — only needed for cross-tenant agent routing |
| `Copilot Studio Timeout` | `30000` | Milliseconds before a bot response times out |
| `Enable A2A` | `false` | Set `true` to enable Agent-to-Agent routing |
| `Primary Agent` | `CopilotStudio` | Default routing target when A2A is enabled |

### Optional — Azure & Backend Services

| Variable | Default | Description |
|----------|---------|-------------|
| `Azure OpenAI Deployment Name` | *(none)* | Chat model deployment (e.g. `gpt-4o`) for Cloud Flow summarization |
| `Functions Base URL` | *(none)* | Base URL for a custom orchestrator Function App |
| `Organization Name` | *(none)* | Shown in chat header and agent greetings |
| `Environment Type` | `local` | Label for logging/diagnostics (`dev`, `demo`, `uat`, `prod`) |
| `Max Retries` | `3` | Retry count for failed API calls |
| `Timeout Seconds` | `30` | General API timeout in seconds |

### Optional — Vision / Camera AI

| Variable | Default | Description |
|----------|---------|-------------|
| `Vision API Endpoint` | *(none)* | Vision proxy Function App URL — leave blank if not using camera features |
| `Vision API Key` | *(none)* | 🔐 Vision proxy Function App key |
| `Vision System Prompt` | *(pre-filled)* | AI prompt for image analysis — customizable per industry |

---

## Developer Setup (Build from Source)

If you want to modify the PCF control source:

### Prerequisites
- Node.js v16+, npm
- .NET Framework 4.8.1+
- Power Platform CLI (`pac`)

### Build

```bash
cd CopilotChatDirectLine
npm install
npm run build        # compile + bundle
npm run start        # PCF test harness
npm run lint         # ESLint
```

### Deploy PCF to Power Platform

```bash
dotnet build CopilotChatBeta.pcfproj /p:Configuration=Release
cd Solutions/CopilotChatBetaSolution
dotnet build /p:Configuration=Release
pac solution import --path bin/Release/CopilotChatBetaSolution.zip --force-overwrite --publish-changes
```

---

## Voice Architecture

```
Canvas App (PCF Chat Control)
        │ HTTPS
        ▼
Azure Function — Speech Proxy (Managed Identity)
        ├── POST /api/azure-tts  → Azure Speech Service (SSML)
        └── POST /api/openai-tts → Azure OpenAI TTS
```

### Option A: Speech Proxy (Recommended)
The proxy (`azure-functions/speech-proxy/`) uses `DefaultAzureCredential` — no API keys needed in the browser or app. The Function App's system-assigned managed identity is granted **Cognitive Services User** on the Speech and OpenAI resources.

### Option B: Direct API Keys
Set `Azure Speech Key` + `Azure Speech Region` (and optionally `Azure OpenAI *` vars) on the PCF control directly.

### Available Voice Profiles

#### OpenAI TTS Voices
| Profile | Voice | Style |
|---------|-------|-------|
| `openai-echo` | Echo | Warm, conversational |
| `openai-alloy` | Alloy | Neutral, balanced |
| `openai-onyx` | Onyx | Deep, authoritative |
| `openai-nova` | Nova | Warm, friendly |
| `openai-shimmer` | Shimmer | Clear, optimistic |

#### Azure Neural Voices
| Profile | Voice | Style |
|---------|-------|-------|
| `jenny-friendly` | Jenny | Friendly (default) |
| `jenny-customerservice` | Jenny | Customer Service |
| `aria-customerservice` | Aria | Business interactions |
| `guy-friendly` | Guy | Male voice |

---

## Multi-Language Support (Beta)

34 languages for speech recognition and TTS. Users select from the Settings panel (⚙️).

| Region | Languages |
|--------|-----------|
| **Americas** | English (US, CA), Spanish (CO, MX, AR, CL, PE, US), Portuguese (BR), French (CA) |
| **Europe** | English (UK), Spanish (ES), French (FR), German, Italian, Dutch, Polish, Swedish, Norwegian, Danish, Finnish, Russian, Ukrainian, Czech, Greek |
| **Asia** | Chinese (Simplified, Traditional, HK), Japanese, Korean, Hindi, Thai, Vietnamese, Indonesian, Malay, Filipino |
| **Middle East/Africa** | Arabic (SA, EG, AE), Hebrew, Turkish, Afrikaans, Swahili |

Set a default language via `DefaultLanguage` control property (BCP-47 code, e.g. `en-US`, `es-MX`).

---

## Admin/Debug Mode (Beta)

Enable via Settings panel (⚙️ → Admin Mode toggle) or set `EnableDebugLog = Yes` on the control.

- 🐛 Timestamped log panel with category filters (speech, audio, console)
- 📧 One-click email export for support escalation
- 📋 Copy logs to clipboard
- 💾 Stores up to 500 entries (persisted across sessions)

> ⚠️ The debug panel may capture sensitive data. Use only for troubleshooting.

---

## Security Best Practices

Store secrets as **Power Platform Environment Variables** linked to **Azure Key Vault**, or use **Dataverse column-level security**. Limit maker portal access to authorized administrators.

🔐 Sensitive variables: `Direct Line Secret`, `Azure Speech Key`, `Azure OpenAI Key`, `Speech Proxy API Key`, `Vision API Key`

---

## Project Structure

```
├── CopilotChatDirectLine/
│   ├── CopilotChatBeta/            # Beta PCF control (v2.0.6) — all features
│   ├── CopilotChatGA/              # GA PCF control — stable
│   ├── Solutions/
│   │   ├── CopilotChatBetaSolution/   # PCF-only solution (Beta)
│   │   ├── CopilotChatGASolution/     # PCF-only solution (GA)
│   │   └── D365MobileCanvasTemplate/  # Full turnkey solution (Canvas App + Agent + Flows)
│   └── package.json
│
├── azure-functions/
│   ├── speech-proxy/               # TTS proxy (DefaultAzureCredential managed identity)
│   │   ├── src/functions/azureTts.ts   # POST /api/azure-tts
│   │   ├── src/functions/openaiTts.ts  # POST /api/openai-tts
│   │   └── src/shared.ts               # Auth + CORS
│   └── vision-proxy/               # Vision/camera analysis proxy
│
├── TokenExchangeFunction/          # Copilot Studio SSO token exchange
├── azuredeploy.json                # ARM template (11 Azure resources)
├── docs/                           # Deployment guides + architecture diagrams
└── README.md
```

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

## Security

See [SECURITY.md](SECURITY.md) for information about reporting security vulnerabilities.

## Support

For support options, see [SUPPORT.md](SUPPORT.md).

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft
trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
