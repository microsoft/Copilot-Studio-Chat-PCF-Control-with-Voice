# Copilot Studio Chat PCF Control with Voice

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Power Platform](https://img.shields.io/badge/Power%20Platform-PCF-purple.svg)](https://docs.microsoft.com/en-us/powerapps/developer/component-framework/overview)

> ⚠️ **DISCLAIMER**: This repository is provided for **demonstration and educational purposes only**. It is not an officially supported Microsoft product. Use of this code is at your own risk. Microsoft makes no warranties, express or implied, and assumes no liability for any issues arising from the use of this repository in production environments.

A Power Apps Component Framework (PCF) control that enables rich chat experiences with Microsoft Copilot Studio, featuring voice input/output and adaptive card support.

## Features

- ✅ **Modern Chat UI** - Clean, responsive chat interface built with Fluent Design
- ✅ **Voice Input** - Speech-to-text using browser Web Speech API or Azure Speech Services
- ✅ **Voice Output** - Text-to-speech with Azure Neural Voices or OpenAI TTS
- ✅ **Adaptive Cards** - Support for rich interactive cards from Copilot Studio
- ✅ **Mobile Support** - Works on iOS, Android, and desktop browsers
- ✅ **Direct Line Integration** - Connects to Copilot Studio via Direct Line API
- ✅ **Driving Mode** - Hands-free operation for field workers (Beta)
- ✅ **Multi-Language Support** - 34 languages with native Azure Neural voices (Beta)
- ✅ **Admin/Debug Mode** - In-app debug logging panel for troubleshooting (Beta)

## Screenshots

<!-- Add screenshots here -->

## Prerequisites

- **Power Apps Environment** with PCF controls enabled
- **Microsoft Copilot Studio** bot with Web channel configured
- **Power Platform CLI** (`pac`) installed
- **Node.js** (v16 or higher) and npm
- **.NET Framework 4.8.1** or higher

### Optional

- **Azure Speech Service** (for premium neural voices)
- **Azure Subscription** (if using Azure Speech Service)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/microsoft/Copilot-Studio-Chat-PCF-Control-with-Voice.git
cd Copilot-Studio-Chat-PCF-Control-with-Voice
```

### 2. Install Dependencies

```bash
cd CopilotChatDirectLine
npm install
```

### 3. Build the Control

```bash
# Build the PCF control
npm run build

# Or use Power Platform CLI
pac pcf push --publisher-prefix YOUR_PREFIX
```

### 4. Configure Copilot Studio

1. Open your Copilot Studio bot
2. Go to **Settings** > **Channels**
3. Add **Web** channel (if not already added)
4. Copy the **Direct Line Secret** from Channel Security

### 5. Add Control to Canvas App

1. Open Power Apps Studio
2. Create or open a Canvas App
3. Go to **Insert** > **Get more components** > **Code components**
4. Select **Copilot Studio Chat** control
5. Add control to your screen
6. Configure properties:
   - **DirectLineSecret**: Your Direct Line secret
   - **DirectLineEndpoint**: Leave default (`https://directline.botframework.com/v3/directline`)

For detailed setup instructions, see the [Setup Guide](SETUP_GUIDE.md).

## Azure Speech Service (Optional)

For premium neural voices instead of browser voices, you have two options:

### Option A: Speech Proxy with Managed Identity (Recommended)

Use the included Azure Function proxy when API key access is disabled or you want to use managed identity. The proxy handles authentication server-side via `DefaultAzureCredential`.

1. Deploy the speech proxy Azure Function from `azure-functions/speech-proxy/`
2. Enable system-assigned managed identity on the Function App
3. Assign **Cognitive Services User** role on your Azure Speech resource
4. Assign **Cognitive Services User** role on your Azure OpenAI resource (if using OpenAI TTS)
5. Configure the Function App settings:
   - `AZURE_SPEECH_REGION`: Your region code (e.g., `eastus`)
   - `AZURE_OPENAI_ENDPOINT`: Your Azure OpenAI endpoint (if using OpenAI TTS)
   - `AZURE_OPENAI_DEPLOYMENT`: TTS deployment name (default: `tts`)
   - `FUNCTION_API_KEY`: A secret key to authenticate client requests
6. Configure the PCF control properties:
   - **SpeechProxyEndpoint**: Your Function App URL (e.g., `https://func-speech-proxy.azurewebsites.net`)
   - **SpeechProxyApiKey**: The `FUNCTION_API_KEY` value you set above

### Option B: Direct API Keys

If your Azure resources have API key access enabled:

1. Create an Azure Speech Service resource in the [Azure Portal](https://portal.azure.com)
2. Copy your **KEY** and **REGION** from Keys and Endpoint
3. Configure the control properties:
   - **SpeechKey**: Your Speech Service key
   - **SpeechRegion**: Your region code (e.g., `eastus`)

## Azure OpenAI TTS (Optional)

For natural-sounding OpenAI voices (English only):

### With Speech Proxy (Recommended)
If using the speech proxy (Option A above), OpenAI TTS is handled automatically — the proxy routes to the OpenAI endpoint configured in its environment variables. No additional PCF control properties are needed.

### With Direct API Keys
1. Create an Azure OpenAI resource with TTS model deployed
2. Configure the control properties:
   - **OpenAIEndpoint**: Your Azure OpenAI endpoint URL
   - **OpenAIKey**: Your Azure OpenAI API key
   - **OpenAIDeployment**: Deployment name (default: `tts`)

### Available Voice Profiles (English)

#### OpenAI TTS Voices (Natural)

| Profile | Voice | Style | Best For |
|---------|-------|-------|----------|
| `openai-echo` | Echo | Warm, conversational | Default - friendly interactions |
| `openai-alloy` | Alloy | Neutral, balanced | General purpose |
| `openai-fable` | Fable | Expressive, narrative | Storytelling |
| `openai-onyx` | Onyx | Deep, authoritative | Professional settings |
| `openai-nova` | Nova | Warm, friendly | Customer service |
| `openai-shimmer` | Shimmer | Clear, optimistic | Upbeat interactions |

#### Azure Neural Voices

| Profile | Voice | Style | Best For |
|---------|-------|-------|----------|
| `jenny-friendly` | Jenny | Friendly | Default, warm conversations |
| `jenny-customerservice` | Jenny | Customer Service | Professional support |
| `aria-customerservice` | Aria | Customer Service | Business interactions |
| `aria-empathetic` | Aria | Empathetic | Sensitive topics |
| `guy-friendly` | Guy | Friendly | Male voice option |
| `davis-chat` | Davis | Chat | Casual conversations |
| `sara-friendly` | Sara | Friendly | Alternative female voice |

## Multi-Language Support (Beta)

The Beta control supports 34 languages for both speech recognition and text-to-speech. Users can select their preferred language from the Settings panel.

### Supported Languages

| Region | Languages |
|--------|-----------|
| **Americas** | English (US, CA), Spanish (CO, MX, AR, CL, PE, US), Portuguese (BR), French (CA) |
| **Europe** | English (UK), Spanish (ES), French (FR), German, Italian, Portuguese (PT), Dutch, Polish, Swedish, Norwegian, Danish, Finnish, Russian, Ukrainian, Czech, Greek |
| **Asia** | Chinese (Simplified, Traditional, HK), Japanese, Korean, Hindi, Thai, Vietnamese, Indonesian, Malay, Filipino |
| **Middle East** | Arabic (SA, EG, AE), Hebrew, Turkish |
| **Africa** | Afrikaans, Swahili |

### Language Selection Priority

1. **User's saved preference** - Persisted in localStorage from Settings
2. **Admin-configured default** - Set via `DefaultLanguage` property
3. **Browser auto-detection** - Falls back to browser locale

### Configuration

Set a default language via the control property:
- **DefaultLanguage**: BCP-47 language code (e.g., `en-US`, `es-MX`, `fr-FR`)

## Admin/Debug Mode (Beta)

The Beta control includes an Admin Mode toggle that enables a debug logging panel for troubleshooting.

### Features

- 🐛 **Debug Panel** - Full-screen overlay showing timestamped log entries
- 📋 **Log Categories** - Filter by level (info, warn, error, debug) or category (speech, audio, console)
- 📧 **Email Logs** - One-click export to email for support escalation
- 📋 **Copy to Clipboard** - Export formatted logs for pasting
- 🔄 **Auto-capture** - Intercepts all console.log/warn/error calls
- 💾 **Persistent** - Stores up to 500 log entries

### Enabling Admin Mode

**Option 1: Settings Panel (User Toggle)**
1. Open the Settings panel (⚙️ button)
2. Scroll to the bottom
3. Toggle **🛠️ Admin Mode** on
4. A debug button (🐛) appears in the toolbar

**Option 2: Admin Property (Pre-configured)**
- Set `EnableDebugLog` property to `Yes` in the control configuration

### Security Note

The debug panel can capture sensitive information. Use only for development/troubleshooting.

## Security Best Practices

### Sensitive Properties

The following control properties contain sensitive credentials that are visible in the Power Apps maker portal:

| Property | Description |
|----------|-------------|
| `DirectLineSecret` | Direct Line Secret from Copilot Studio |
| `SpeechKey` | Azure Speech Service subscription key |
| `OpenAIKey` | Azure OpenAI API key |
| `SpeechProxyApiKey` | API key for the speech proxy Azure Function |

### Recommendations for Production

1. **Environment Variables** - Store secrets as Power Platform Environment Variables, optionally linked to Azure Key Vault
2. **Dataverse Secure Columns** - Store secrets in Dataverse columns with column-level security
3. **Role-Based Access** - Limit maker portal access to authorized administrators only

> ⚠️ Property descriptions now include 🔐 SENSITIVE warnings to remind administrators.

## Environment Variables Reference

The **D365MobileCanvasTemplate** solution ships with Power Platform Environment Variables for configuration. After importing, set values for your environment in the solution's Environment Variables section.

### Required — Core

| Variable | Description |
|----------|-------------|
| `bw_DirectLineSecret` | 🔐 Direct Line secret from Copilot Studio (Settings → Channels → Direct Line) |
| `bw_DirectLineEndpoint` | Direct Line endpoint URL. Default: `https://directline.botframework.com/v3/directline` |

### Required — Voice (choose one option)

#### Option A: Speech Proxy (Recommended — for managed identity / no API keys)

| Variable | Description |
|----------|-------------|
| `bw_SpeechProxyEndpoint` | Azure Function speech proxy URL (e.g., `https://func-speech-proxy.azurewebsites.net`) |
| `bw_SpeechProxyApiKey` | 🔐 API key for authenticating to the proxy (`FUNCTION_API_KEY` value) |
| `bw_SpeechRegion` | Azure region for Speech Service (e.g., `eastus`) |

#### Option B: Direct API Keys

| Variable | Description |
|----------|-------------|
| `bw_SpeechKey` | 🔐 Azure Speech Services subscription key |
| `bw_SpeechRegion` | Azure region (e.g., `eastus`) |
| `bw_OpenAIEndpoint` | Azure OpenAI endpoint URL (for TTS voices) |
| `bw_OpenAIKey` | 🔐 Azure OpenAI API key |
| `bw_OpenAIDeployment` | TTS deployment name (default: `tts`) |

### Optional — Copilot Studio Agent

| Variable | Description |
|----------|-------------|
| `bw_CopilotStudioBotID` | Bot ID from Copilot Studio |
| `bw_CopilotStudioTenantID` | Power Platform environment ID |
| `bw_COPILOT_STUDIO_ENDPOINT` | Direct Line endpoint for the bot (if different from default) |
| `bw_Copilot_Studio_Timeout` | Bot response timeout in seconds (default: `30`) |
| `bw_PrimaryAgent` | Primary agent type: `CopilotStudio`, `AzureOpenAI`, etc. |
| `bw_EnableA2A` | Enable agent-to-agent routing (`true` / `false`) |
| `bw_FallbackAgent` | Fallback agent identifier |

### Optional — Azure Services

| Variable | Description |
|----------|-------------|
| `bw_DATAVERSE_URL` | Dataverse org URL (e.g., `https://org.crm.dynamics.com`) |
| `bw_FunctionsBaseURL` | Base URL for orchestrator Azure Functions / Container Apps |
| `bw_AzureOpenAIDeploymentName` | Azure OpenAI chat deployment name (e.g., `gpt-4o-mini`) |
| `bw_AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint (for orchestrator, not TTS) |

### Optional — Vision (Camera AI)

| Variable | Description |
|----------|-------------|
| `bw_VisionEndpoint` | Vision proxy Azure Function URL (e.g., `https://func.azurewebsites.net/api/analyze`) |
| `bw_VisionApiKey` | 🔐 API key for vision proxy function |
| `bw_VisionSystemPrompt` | System prompt for image analysis (customizable per industry) |

### Optional — General

| Variable | Description |
|----------|-------------|
| `bw_OrganizationName` | Display name for the organization |
| `bw_EnvironmentType` | Environment label (`local`, `dev`, `demo`, `prod`) |
| `bw_MaxRetries` | Max retry count for API calls |
| `bw_TimeoutSeconds` | General timeout in seconds |
| `bw_SalesforceAgentEndpoint` | Salesforce Agentforce endpoint (if using cross-platform agents) |
| `bw_CUSTOM_LOGO_URL` | CDN/blob URL for custom branding logo |

## Project Structure

```
├── CopilotChatDirectLine/          # PCF Control Source
│   ├── CopilotChatBeta/           # Beta version (v2.0.6 - latest features)
│   ├── CopilotChatGA/             # General Availability (v1.3.3 - stable)
│   ├── Solutions/                 # Power Platform solution project
│   └── package.json
│
├── azure-functions/                # Azure Function Proxies
│   ├── speech-proxy/              # TTS proxy with managed identity (DefaultAzureCredential)
│   │   ├── src/functions/
│   │   │   ├── azureTts.ts        # POST /api/azure-tts - Azure Speech TTS
│   │   │   └── openaiTts.ts       # POST /api/openai-tts - Azure OpenAI TTS
│   │   └── src/shared.ts          # Auth + CORS helpers
│   └── vision-proxy/              # Vision API proxy
│
├── TokenExchangeFunction/         # Token Exchange for Copilot Studio auth
│
├── CopilotChatPCFControl/         # Legacy Solution Package
│   └── src/
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
