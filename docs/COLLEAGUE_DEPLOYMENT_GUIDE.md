# Outside Sales Agent — Deployment Guide

> **Version**: 2.0 | **Date**: March 2026 | **Prepared by**: Bill Whalen, Solution Engineering

---

> **No local tools required!** This entire deployment can be completed from a web browser. You do NOT need Azure CLI, VS Code, Node.js, or PowerShell installed locally. Everything uses the Azure Portal, Azure Cloud Shell (built into the Portal), and Power Platform web interfaces.

---

## Overview

This package deploys the **Outside Sales Agent** — a Dynamics 365 Canvas App with an embedded Copilot Studio Agent and a voice-enabled PCF chat control backed by Azure Speech and OpenAI TTS services.

### What's Included

| File | Description |
|------|-------------|
| `D365MobileCanvasTemplate_1.2.0_turnkey.zip` | Power Platform solution — Canvas App + Copilot Studio Agent + Custom Pages + Workflows + all PCF Controls |
| `azuredeploy.json` | ARM template — deploys the full Azure Speech Proxy stack (11 resources) |
| `azuredeploy.parameters.json` | ARM template parameters file |
| `speech-proxy/` | Azure Function source code & pre-built output for the speech/TTS proxy |

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  Dynamics 365 / Power Apps                          │
│  ┌───────────────────────────────────────────────┐  │
│  │  Canvas App (D365MobileCanvasTemplate)        │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  PCF Chat Control                       │  │  │
│  │  │  • Voice Input  (Web Speech API/Azure)  │  │  │
│  │  │  • Voice Output (Azure TTS / OpenAI)    │  │  │
│  │  │  • Adaptive Cards & Driving Mode        │  │  │
│  │  └──────────────┬──────────────────────────┘  │  │
│  └─────────────────┼─────────────────────────────┘  │
│                    │                                 │
│  ┌─────────────────┼─────────────────────────────┐  │
│  │  Copilot Studio Agent (Direct Line)           │  │
│  │  • Dataverse Actions & Workflows              │  │
│  └─────────────────┼─────────────────────────────┘  │
└────────────────────┼────────────────────────────────┘
                     │ HTTPS
        ┌────────────┴────────────┐
        │  Azure Function         │
        │  Speech Proxy           │
        │  (Managed Identity)     │
        ├─────────┬───────────────┤
        │         │               │
   ┌────┴────┐  ┌─┴───────────┐
   │ Azure   │  │ Azure OpenAI │
   │ Speech  │  │ (TTS Model)  │
   └─────────┘  └──────────────┘
```

---

## Prerequisites

### What You Need (all browser-based)

- **Azure subscription** with **Contributor** + **User Access Administrator** (or Owner) on a resource group
- **Power Apps environment** with **Dynamics 365 Sales** (Sales Enterprise or Professional) installed
- **System Administrator** or **System Customizer** security role in D365
- A modern web browser (Edge, Chrome, or Firefox)

### Enable PCF Controls (one-time setting)

1. Go to [admin.powerplatform.microsoft.com](https://admin.powerplatform.microsoft.com)
2. Select **Environments** → click your environment
3. Click **Settings** (top bar) → **Features**
4. Turn **ON**: *"Allow publishing of canvas apps with code components"*
5. Click **Save**

> **No local installs needed!** You do NOT need Azure CLI, VS Code, Node.js, PowerShell, or Power Platform CLI on your machine.

---

## Step 1: Deploy Azure Resources 🌐

Click the button below to deploy 11 Azure resources in a single click. This opens the Azure Portal with a pre-filled deployment form.

### 1.1 Generate an API Key

First, generate a secret API key for the speech proxy using **Azure Cloud Shell**:

1. Go to [portal.azure.com](https://portal.azure.com) and sign in
2. Click the **Cloud Shell** icon (`>_`) in the top navigation bar
3. If prompted, select **Bash** and click **"Create storage"** (first-time setup only)
4. Run this command:

```bash
openssl rand -hex 16
```

**Copy the output** (e.g., `a3f7b2c9e1d04f8a6b5c7d9e0f1a2b3c`). You'll use this in the next step and again in Step 4.

### 1.2 Deploy to Azure

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fbillwhalenmsft%2FCopilot-Studio-Chat-PCF-Control-with-Voice-1%2Fmain%2Fazuredeploy.json)

Fill in the deployment form:

1. Select or create a **Resource Group** (e.g., `rg-outside-sales-agent`)
2. Set **Region** to a region that supports Azure Speech (e.g., `East US`)
3. Enter a **Resource Prefix** — a unique 3–15 character lowercase string (e.g., `outsales`)
4. Paste your **Function Api Key** from Step 1.1
5. Leave other parameters as defaults (or adjust — see table below)
6. Click **Review + Create**, then **Create**
7. Wait for deployment to complete (~3–5 minutes)

#### What Gets Created

| Resource | Type | Purpose |
|----------|------|---------|
| `{prefix}-speech` | Cognitive Services | Neural voice synthesis (STT/TTS) |
| `{prefix}-openai` | Azure OpenAI | TTS model + GPT-4o-mini chat model |
| `func-speech-proxy-{prefix}` | Function App | Speech proxy with managed identity |
| `{prefix}-plan` | App Service Plan | Compute (Y1 Consumption by default) |
| `{prefix}stg` | Storage Account | Function App runtime storage |
| `{prefix}-insights` | Application Insights | Monitoring & APM |
| `{prefix}-logs` | Log Analytics | Centralized logging |
| 2× RBAC assignments | Role Assignment | Cognitive Services User → Function App |
| 2× Model deployments | OpenAI Deployment | GPT-4o-mini (chat) + TTS |

#### Parameter Reference

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `resourcePrefix` | **Yes** | — | 3–15 char prefix for all resource names |
| `functionApiKey` | **Yes** | — | The API key generated in Step 1.1 |
| `location` | No | RG location | Region for Speech, Function App, support resources |
| `openAILocation` | No | `northcentralus` | Region for Azure OpenAI (must have TTS quota) |
| `openAIModelName` | No | `gpt-4o-mini` | Chat model |
| `ttsModelName` | No | `tts` | TTS model (`tts` or `tts-hd`) |
| `speechServiceSku` | No | `S0` | `F0` (free) or `S0` (standard) |
| `functionAppSku` | No | `Y1` | `Y1` (consumption), `B1`/`S1` (dedicated, Always On) |

### 1.3 Capture the Deployment Outputs

After deployment completes:

1. In the Azure Portal, click **"Go to resource group"** (or navigate to your resource group)
2. Click **Deployments** in the left sidebar
3. Click the deployment name (e.g., `Microsoft.Template`)
4. Click the **Outputs** tab
5. Copy these values — you'll need them in Step 4:

| ARM Output | → Environment Variable | Example Value |
|------------|----------------------|---------------|
| `speechProxyEndpoint` | `bw_SpeechProxyEndpoint` | `https://func-speech-proxy-outsales.azurewebsites.net` |
| `speechProxyApiKey` | `bw_SpeechProxyApiKey` | *(the key you generated in 1.1)* |
| `speechRegion` | `bw_SpeechRegion` | `eastus` |
| `openAIEndpoint` | `bw_OpenAIEndpoint` | `https://outsales-openai.openai.azure.com/` |
| `openAIDeploymentName` | `bw_OpenAIDeployment` | `tts` |
| `functionAppName` | *(used in Step 2)* | `func-speech-proxy-outsales` |
| `speechResourceName` | *(used for legacy keys)* | `outsales-speech` |
| `openAIResourceName` | *(used for legacy keys)* | `outsales-openai` |

> **Tip:** Keep this Outputs tab open — you'll reference these values several times.

### 1.4 Get Legacy API Keys (required for some Cloud Flows)

Some Cloud Flows in the solution use direct API keys. Get them from the Azure Portal:

1. In your resource group, click **{prefix}-speech** → **Keys and Endpoint** → copy **Key 1**
2. Go back and click **{prefix}-openai** → **Keys and Endpoint** → copy **Key 1**

Save both keys — you'll enter them as environment variables in Step 4.

---

## Step 2: Deploy the Speech Proxy Code ☁️

The ARM template created the Function App infrastructure, but you still need to deploy the actual proxy code. This is done entirely from **Azure Cloud Shell** — no local tools needed.

### 2.1 Open Azure Cloud Shell

1. In the [Azure Portal](https://portal.azure.com), click the **Cloud Shell** icon (`>_`) in the top bar
2. Select **Bash** if prompted

### 2.2 Clone, Build, and Deploy

Run these commands one at a time in Cloud Shell. Replace `<functionAppName>` and `<resourceGroup>` with your actual values from Step 1.3.

```bash
# 1. Clone the repository (one-time)
git clone https://github.com/billwhalenmsft/Copilot-Studio-Chat-PCF-Control-with-Voice-1.git \
  --depth 1

# 2. Navigate to the speech proxy folder
cd Copilot-Studio-Chat-PCF-Control-with-Voice-1/azure-functions/speech-proxy

# 3. Install dependencies and build
npm install
npm run build

# 4. Create deployment zip
zip -r deploy.zip host.json package.json package-lock.json dist/ node_modules/

# 5. Deploy to Azure (replace with YOUR values)
az functionapp deployment source config-zip \
  --name "<functionAppName>" \
  --resource-group "<resourceGroup>" \
  --src deploy.zip

# 6. Restart the function app
az functionapp restart \
  --name "<functionAppName>" \
  --resource-group "<resourceGroup>"
```

> **Example:** If your function app is `func-speech-proxy-outsales` and resource group is `rg-outside-sales-agent`:
> ```
> az functionapp deployment source config-zip --name "func-speech-proxy-outsales" --resource-group "rg-outside-sales-agent" --src deploy.zip
> ```

### 2.3 Verify the Proxy

Test the proxy is working (still in Cloud Shell):

```bash
curl -X POST "<speechProxyEndpoint>/api/azureTts" \
  -H "x-api-key: <apiKey>" \
  -H "Content-Type: application/ssml+xml" \
  -d '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="en-US-JennyNeural">Hello</voice></speak>' \
  -o /dev/null -w "HTTP %{http_code}\n"
```

> **Success:** `HTTP 200` means the proxy is working. `HTTP 401` = wrong API key. `HTTP 500` = RBAC may still be propagating — wait 2–3 minutes and retry.

---

## Step 3: Import Power Platform Solution 🌐

> **One import does it all!** The turnkey solution includes everything — Canvas App, Copilot Studio Agent, Custom Pages, 22 Cloud Flows, and all PCF Controls.

### 3.1 Import the Solution

1. Go to [make.powerapps.com](https://make.powerapps.com)
2. Select your **environment** from the top-right environment picker
3. Click **Solutions** in the left navigation
4. Click **Import solution** in the top toolbar
5. Click **Browse** and select `D365MobileCanvasTemplate_1.2.0_turnkey.zip` from this deployment package
6. Click **Next**
7. On the **Connection References** page, create or select connections for:
   - **Dataverse** — sign in with your D365 credentials
   - **Office 365 Outlook** — sign in with your email account
   - Any other connectors shown
8. Click **Import**
9. Wait for the import to complete (5–10 minutes — you'll see a green checkmark)

> **Dependency:** This solution requires Dynamics 365 Sales entities (Account, Opportunity, Sales Order). If import fails with missing dependencies, ensure D365 Sales is installed in your environment.

### 3.2 Verify Import

1. In **Solutions**, you should see **D365MobileCanvasTemplate** listed
2. Click it to open — you should see Apps, Bot components, Environment Variables, Cloud Flows, and Controls

---

## Step 4: Configure D365 Environment Variables 🌐

> **Critical!** After import, all environment variables are BLANK. The Canvas App reads these at runtime to connect to Azure services and Copilot Studio. You must set them or the app will not function.

### 4.1 Open Environment Variables

1. Go to [make.powerapps.com](https://make.powerapps.com) → select your environment
2. Click **Solutions** → open **D365MobileCanvasTemplate**
3. In the left panel, filter by **Environment variables**
4. Click each variable, then click **+ New value** (or edit the existing value) to set it

> **Shortcut:** You can also set them via the **gear icon** → **Environment variables** in make.powerapps.com.

### 4.2 Required — Voice / Speech Proxy

These values come from the ARM deployment outputs (Step 1.3):

| Environment Variable | Display Name | Value (from ARM output) |
|---------------------|-------------|------------------------|
| `bw_SpeechProxyEndpoint` | Speech Proxy Endpoint | `https://func-speech-proxy-<prefix>.azurewebsites.net` |
| `bw_SpeechProxyApiKey` | Speech Proxy API Key | The API key you generated in Step 1.1 |
| `bw_SpeechRegion` | Azure Speech Region | e.g., `eastus` (from output `speechRegion`) |
| `bw_OpenAIEndpoint` | Azure OpenAI Endpoint | `https://<prefix>-openai.openai.azure.com/` |
| `bw_OpenAIDeployment` | Azure OpenAI TTS Deployment | `tts` (from output `openAIDeploymentName`) |

### 4.3 Required — Copilot Studio / Direct Line

| Environment Variable | Display Name | Value |
|---------------------|-------------|-------|
| `bw_DirectLineSecret` | Direct Line Secret | **Get from Step 5** (Copilot Studio → Channels → Web → Channel Security) |
| `bw_DirectLineEndpoint` | Direct Line Endpoint | `https://directline.botframework.com/v3/directline` |

### 4.4 Required — Dataverse

| Environment Variable | Display Name | Value |
|---------------------|-------------|-------|
| `bw_DATAVERSE_URL` | Dataverse URL | `https://YOUR-ORG.crm.dynamics.com/` |
| `bw_OrganizationName` | Organization Name | Your org display name |

### 4.5 Legacy Keys (required — some Cloud Flows use these)

Get these from the Azure Portal (Step 1.4):

| Environment Variable | Display Name | Where to Get |
|---------------------|-------------|-----------|
| `bw_SpeechKey` | Azure Speech Key | Azure Portal → `{prefix}-speech` → Keys and Endpoint → Key 1 |
| `bw_OpenAIKey` | Azure OpenAI Key | Azure Portal → `{prefix}-openai` → Keys and Endpoint → Key 1 |
| `bw_AzureOpenAIDeploymentName` | Azure OpenAI Deployment | The chat model deployment name: `gpt-4o-mini` |

### 4.6 Optional — Defaults (can leave blank or use suggested values)

| Environment Variable | Display Name | Suggested Value |
|---------------------|-------------|----------------|
| `bw_EnvironmentType` | Env | `demo` |
| `bw_PrimaryAgent` | Primary Agent | `CopilotStudio` |
| `bw_MaxRetries` | Max Retries | `3` |
| `bw_TimeoutSeconds` | Timeout Seconds | `30` |
| `bw_Copilot_Studio_Timeout` | Copilot Studio Timeout | `120` |
| `bw_EnableA2A` | Enable A2A | `false` |
| `bw_FunctionsBaseURL` | Functions Base URL | *(leave blank)* |
| `bw_COPILOT_STUDIO_ENDPOINT` | Copilot Studio Endpoint | *(leave blank)* |
| `bw_CopilotStudioBotID` | Copilot Studio Bot ID | *(leave blank)* |
| `bw_CopilotStudioTenantID` | Copilot Studio Tenant ID | *(leave blank)* |

### 4.7 Optional — Vision AI (Beta)

Only set these if you want camera/vision features:

| Environment Variable | Display Name | Value |
|---------------------|-------------|-------|
| `bw_VisionEndpoint` | Vision API Endpoint | Azure OpenAI endpoint with GPT-4o Vision |
| `bw_VisionApiKey` | Vision API Key | API key for the Vision-capable model |
| `bw_VisionSystemPrompt` | Vision System Prompt | Custom prompt for image analysis |

---

## Step 5: Configure Copilot Studio Agent 🌐

The Copilot Studio Agent is included in the turnkey solution. After import, get its Direct Line secret:

1. Go to [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com)
2. Select your **environment** from the environment picker (top right)
3. Find the imported agent in the agent list
4. Click the agent to open it → go to **Settings** (gear icon)
5. Navigate to **Channels** → **Web**
6. Under **Channel Security**, copy the **Direct Line Secret**
7. Go back to [make.powerapps.com](https://make.powerapps.com) → **Solutions** → **D365MobileCanvasTemplate** → **Environment Variables**
8. Set `bw_DirectLineSecret` to the Direct Line Secret you just copied

### Agent Capabilities (Pre-Built)

- **Dataverse Actions**: Account lookup, order details, contact search, activity history
- **Cloud Flows**: Email drafting, note creation, adaptive card generation
- **Knowledge**: Connected to D365 Sales data via Dataverse connector
- **Formulas**: Calculated fields for revenue, fulfillment, engagement metrics

---

## Step 6: Launch & Test 🌐

### 6.1 Open the App

1. In [make.powerapps.com](https://make.powerapps.com), go to **Apps**
2. Find **D365 Mobile Canvas Template**
3. Click **Play** (▶) to launch it

### 6.2 Test the Agent

Try these sample questions in the chat:
- "Show me my top accounts"
- "What orders are pending for Contoso?"
- "Draft a follow-up email for my last meeting"

### 6.3 Test Voice

1. Click the **microphone** icon in the chat control
2. Speak a question — you should see it transcribed
3. The agent's response should play back in a **natural neural voice** (not robotic)

> **If voice sounds robotic:** The speech proxy is not connected. Check `bw_SpeechProxyEndpoint` and `bw_SpeechProxyApiKey` in Step 4.

### 6.4 Publish for Users

1. In make.powerapps.com → **Apps** → click **...** next to the app → **Share**
2. Add users or security groups
3. Users access the app from [apps.powerapps.com](https://apps.powerapps.com) or natively in Dynamics 365

---

## Troubleshooting

### ARM Deployment Fails

| Error | Solution |
|-------|----------|
| `QuotaExceeded` for TTS model | Try a different `openAILocation` (e.g., `swedencentral`, `eastus2`) |
| `ResourceNotFound` for model version | Check model availability in Azure Portal → OpenAI resource → Model Deployments |
| Quota for VM types is 0 | For B1/S1 plans, request a quota increase. Y1 (Consumption) doesn't require VM quota. |

### Cloud Shell Issues

| Issue | Solution |
|-------|----------|
| `npm: command not found` | Run `nvm use 20` to activate Node.js 20 |
| Zip deploy fails with 403 | Ensure correct subscription: `az account show`. Switch with `az account set --subscription "<id>"` |
| Cloud Shell times out | Re-open and `cd` back — files are preserved in Azure storage |

### Solution Import Fails

| Error | Solution |
|-------|----------|
| Missing dependencies | Ensure D365 Sales is installed in the environment |
| PCF control not found | PCF controls are included — ensure import completed and PCF is enabled (see Prerequisites) |
| Connection reference errors | Create new connections during import for Dataverse and Office 365 Outlook |

### Voice Not Working

| Symptom | Cause | Fix |
|---------|-------|-----|
| Robotic / browser voice | Speech proxy not configured | Verify `bw_SpeechProxyEndpoint` and `bw_SpeechProxyApiKey` env vars |
| TTS 401 error | Managed identity not authorized | Check RBAC in Azure Portal → Speech/OpenAI resource → Access Control (IAM) |
| No voice output | Proxy code not deployed | Complete Step 2 (deploy speech proxy via Cloud Shell) |
| Cold start delay (5–15s) | Y1 (Consumption) plan | Upgrade to B1: Azure Portal → App Service Plan → Scale Up |

### App Errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| "This app ran into a problem" | Missing environment variables | Ensure all required env vars are set (Step 4) |
| Chat control blank / white | Direct Line connection failed | Verify `bw_DirectLineSecret` is valid (Step 5) |
| No adaptive cards | Cloud Flows disabled | Open solution → Cloud Flows → turn on disabled flows |

---

## Regional Availability Notes

- **Azure Speech Service**: Available in most regions. See [Speech Service regions](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions)
- **Azure OpenAI TTS model**: Limited availability. Confirmed working in: `northcentralus`, `swedencentral`. See [OpenAI model availability](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)
- **Custom subdomain**: Created automatically by the ARM template (required for managed identity auth)

---

## Advanced — CLI Alternative

If you prefer local tools instead of Cloud Shell, see the CLI commands in the HTML version of this guide.

### Local Prerequisites

- Azure CLI (`az --version` ≥ 2.50) — [Install guide](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
- Node.js 20 LTS — [nodejs.org](https://nodejs.org/)
- PowerShell 7+ or Windows PowerShell 5.1
- Power Platform CLI (`pac`) — [Install guide](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction)

---

## Support

For questions or issues, contact Bill Whalen (Solution Engineering).
