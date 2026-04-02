# 🚀 D365 Mobile Canvas Template with Agentic Voice
## Copilot Studio connected · Azure Speech & OpenAI Speech integration

---

## Solution Overview Video
[▶️ Watch the demo](https://microsoft-my.sharepoint.com/:v:/p/billwhalen/IQC3zrVwkg_3SIWoNextCDZ0AQlvqcg71vKABDaufI-HxWI?e=WhAYob&nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D)

---

## What's in the Package

| File | Description |
|------|-------------|
| D365MobileCanvasTemplate_1.2.0_turnkey.zip | Power Platform solution — Canvas App + Copilot Studio Agent + Custom Pages + 22 Workflows + PCF Chat Controls (Beta v2.0.9 + GA v2.0.0) |
| azuredeploy.json | ARM template — deploys full Azure Speech Proxy stack (11 resources) |
| azuredeploy.parameters.json | Parameters file (fill in your values) |
| speech-proxy/ | Azure Function source + pre-built for the speech/TTS proxy |
| DEPLOYMENT_GUIDE.html | Full deployment guide (open in any browser) |
| DEPLOYMENT_GUIDE.md | Same guide in Markdown |

📥 **Download:** [OutsideSalesAgent-DeployPackage.zip](#) *(update this link with your OneDrive/SharePoint share link)*

---

## Prerequisites

### Azure
- Azure subscription with **Contributor** + **User Access Administrator** (or Owner) role
- Azure CLI installed (az --version ≥ 2.50)
- PowerShell 7+ or Windows PowerShell 5.1

### Power Platform
- Power Apps environment with **Dynamics 365 Sales** (Enterprise or Professional)
- PCF controls enabled: Admin Center → Environments → Settings → Features → *Allow publishing of canvas apps with code components* → **On**
- Power Platform CLI (pac) installed and authenticated
- System Administrator or System Customizer security role

---

## Step 1 — Deploy Azure Resources

The ARM template deploys **11 resources** in one click:

| # | Resource | Purpose |
|---|----------|---------|
| 1 | Azure Speech Service | Neural voice TTS & speech-to-text |
| 2 | Azure OpenAI | TTS model hosting + chat model |
| 3 | GPT-4o-mini deployment | Cost-effective chat model (GlobalStandard) |
| 4 | TTS model deployment | Text-to-speech (Standard) |
| 5 | Function App | Speech proxy with managed identity (no API keys exposed!) |
| 6 | App Service Plan | Compute for Function App (Y1/B1/S1) |
| 7 | Storage Account | Function App runtime storage |
| 8 | Application Insights | Monitoring & APM |
| 9 | Log Analytics | Centralized logging |
| 10 | RBAC — Speech | Cognitive Services User → Function App |
| 11 | RBAC — OpenAI | Cognitive Services User → Function App |

### 1.1 Generate an API Key

```powershell
$apiKey = [guid]::NewGuid().ToString('N').Substring(0, 32)
Write-Host "Your API Key: $apiKey"
```
💡 Save this — you'll need it for the ARM template AND the PCF control.

### 1.2 Deploy via Azure CLI

```powershell
az login

$rgName = "rg-outside-sales-agent"
$location = "eastus"
az group create --name $rgName --location $location

az deployment group create `
  --resource-group $rgName `
  --template-file azuredeploy.json `
  --parameters azuredeploy.parameters.json `
  --parameters resourcePrefix="YOUR-PREFIX" `
               functionApiKey="$apiKey"
```

> Replace YOUR-PREFIX with a 3-15 character string (e.g., `outsales`). This prefixes all resource names.

### 1.3 Key Parameters

| Parameter | Required | Default | Notes |
|-----------|----------|---------|-------|
| resourcePrefix | **Yes** | — | 3-15 char prefix for all resources |
| functionApiKey | **Yes** | — | API key from step 1.1 |
| location | No | RG location | Region for Speech + Function App |
| openAILocation | No | northcentralus | Region for OpenAI (must have TTS quota) |
| functionAppSku | No | Y1 | Y1 = consumption, B1/S1 = dedicated (Always On) |
| ttsModelName | No | tts | tts or tts-hd |

### 1.4 Capture Output Values

```powershell
az deployment group show `
  --resource-group $rgName `
  --name azuredeploy `
  --query properties.outputs -o json
```

| Output | → Environment Variable |
|--------|---------------|
| speechProxyEndpoint | bw_SpeechProxyEndpoint |
| speechProxyApiKey | bw_SpeechProxyApiKey |
| speechRegion | bw_SpeechRegion |
| openAIEndpoint | bw_OpenAIEndpoint |
| openAIDeploymentName | bw_OpenAIDeployment |
| functionAppName | *(used for code deploy in Step 2)* |
| speechResourceName | *(used to get bw_SpeechKey)* |
| openAIResourceName | *(used to get bw_OpenAIKey)* |

---

## Step 2 — Deploy Speech Proxy Code

The ARM template creates the Function App, but you still need to push the proxy code:

```powershell
cd speech-proxy
npm install
npm run build

Compress-Archive -Path host.json, package.json, package-lock.json, dist, node_modules `
  -DestinationPath deploy.zip -Force

az functionapp deployment source config-zip `
  --name "<functionAppName>" `
  --resource-group $rgName `
  --src deploy.zip

az functionapp restart --name "<functionAppName>" --resource-group $rgName
```

### Verify

```powershell
Invoke-RestMethod "https://<functionAppName>.azurewebsites.net/api/azureTts" `
  -Method POST `
  -Headers @{ "x-api-key" = "$apiKey"; "Content-Type" = "application/ssml+xml" } `
  -Body '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="en-US-JennyNeural">Test.</voice></speak>'
```
✅ If you get audio bytes back, the proxy is working.

---

## Step 3 — Import Power Platform Solution

The turnkey solution includes **everything** — Canvas App, Copilot Studio Agent, Custom Pages, 22 Cloud Flows, and all PCF controls (Beta v2.0.9 + GA v2.0.0). Just one import.

### 3.1 Authenticate

```powershell
pac auth create --environment "https://YOUR-ORG.crm.dynamics.com/"
```

### 3.2 Import the Solution

```powershell
pac solution import --path D365MobileCanvasTemplate_1.2.0_turnkey.zip --force-overwrite --publish-changes --async
```

> 📦 Contains 126 bot components, 3 Canvas Apps, 22 Cloud Flows, 18 PCF Controls, Custom Pages. Takes ~5-10 min.

> ⚠️ Requires Dynamics 365 Sales entities (Account, Opportunity, Sales Order).

### 3.3 Verify

```powershell
pac solution list | Select-String "D365Mobile"
```

---

## Step 4 — Configure D365 Environment Variables

The solution uses **environment variables** to pass configuration to the Canvas App and PCF controls. After import, all values are blank — you must set them.

### How to Set Env Vars

1. Go to [make.powerapps.com](https://make.powerapps.com) → select your environment
2. **Solutions** → open **D365MobileCanvasTemplate**
3. Filter by **Environment variables** in the left panel

> 💡 You can also use **Settings** (gear icon) → **Environment variables** in make.powerapps.com.

### 4.1 Required — Voice / Speech Proxy (from ARM outputs)

| Environment Variable | Display Name | Value |
|---------------------|-------------|-------|
| bw_SpeechProxyEndpoint | Speech Proxy Endpoint | `https://func-speech-proxy-PREFIX.azurewebsites.net` |
| bw_SpeechProxyApiKey | Speech Proxy API Key | Your API key from Step 1.1 |
| bw_SpeechRegion | Azure Speech Region | e.g., `eastus` |
| bw_OpenAIEndpoint | Azure OpenAI Endpoint | `https://PREFIX-openai.openai.azure.com/` |
| bw_OpenAIDeployment | Azure OpenAI TTS Deployment | `tts` |

### 4.2 Required — Direct Line

| Environment Variable | Display Name | Value |
|---------------------|-------------|-------|
| bw_DirectLineSecret | Direct Line Secret | **Get from Step 5** (Copilot Studio → Channels → Web) |
| bw_DirectLineEndpoint | Direct Line Endpoint | `https://directline.botframework.com/v3/directline` |

### 4.3 Required — Dataverse

| Environment Variable | Display Name | Value |
|---------------------|-------------|-------|
| bw_DATAVERSE_URL | Dataverse URL | `https://YOUR-ORG.crm.dynamics.com/` |
| bw_OrganizationName | Organization Name | Your org display name |

### 4.4 Legacy Keys (Cloud Flows may reference these)

```powershell
# Get keys from CLI:
az cognitiveservices account keys list --name "<speechResourceName>" --resource-group $rgName --query key1 -o tsv
az cognitiveservices account keys list --name "<openAIResourceName>" --resource-group $rgName --query key1 -o tsv
```

| Environment Variable | Display Name | How to Get |
|---------------------|-------------|-----------|
| bw_SpeechKey | Azure Speech Key | Speech resource → Keys and Endpoint → Key 1 |
| bw_OpenAIKey | Azure OpenAI Key | OpenAI resource → Keys and Endpoint → Key 1 |
| bw_AzureOpenAIDeploymentName | Azure OpenAI Deployment Name | Chat model name (e.g., `gpt-4o-mini`) |

### 4.5 Optional — Defaults

| Environment Variable | Suggested Value |
|---------------------|----------------|
| bw_EnvironmentType | `demo` |
| bw_PrimaryAgent | `CopilotStudio` |
| bw_MaxRetries | `3` |
| bw_TimeoutSeconds | `30` |
| bw_Copilot_Studio_Timeout | `120` |
| bw_EnableA2A | `false` |
| bw_FunctionsBaseURL | *(leave blank)* |

---

## Step 5 — Connect the Copilot Studio Agent

The agent is included in the turnkey solution. After import:

1. Go to [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com)
2. Find the imported agent
3. **Settings** → **Channels** → **Web** → copy **Direct Line Secret**
4. Go back to **make.powerapps.com** → Environment Variables → set **bw_DirectLineSecret** to this value

### Included Agent Capabilities
- 📊 **Dataverse Actions:** Account lookup, order details, contact search, activity history
- 📧 **Cloud Flows:** Email drafting, note creation, adaptive card generation
- 🔗 **Knowledge:** Connected to D365 Sales via Dataverse connector
- 📐 **Formulas:** Revenue, fulfillment, engagement metrics

---

## Optional: Camera & Vision AI (Beta, Incomplete)

Enable camera for equipment inspection, barcode scanning, or visual analysis with Azure OpenAI GPT-4o Vision.

| Env Variable | Value |
|-------------|-------|
| bw_VisionEndpoint | Azure OpenAI endpoint |
| bw_VisionApiKey | API key for Vision-capable OpenAI |
| bw_VisionSystemPrompt | Custom prompt for image analysis |

Camera button appears when EnableCamera=Yes and Vision variables are configured.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Chat shows "Unable to connect" | Verify DirectLineSecret, bot has Web channel enabled |
| Robotic/browser voice | Set SpeechProxyEndpoint and SpeechProxyApiKey |
| TTS 401 error | RBAC role assignments may not have propagated — wait 5 min and retry |
| No voice output | Deploy speech-proxy code (Step 2) |
| Cold start delay (5-15s) | Upgrade functionAppSku to B1 for Always On |
| "This app ran into a problem" | Ensure all environment variables are set (Step 4) |
| ARM QuotaExceeded for TTS | Try different openAILocation (swedencentral, northcentralus) |
| Solution import fails | Ensure D365 Sales installed in the environment |

---

## Quick Links

- [GitHub Repo](https://github.com/microsoft/Copilot-Studio-Chat-PCF-Control-with-Voice)
- [Power Apps Maker Portal](https://make.powerapps.com/)
- [Azure Portal](https://portal.azure.com/)
- [Copilot Studio](https://copilotstudio.microsoft.com/)
- [Speech Service Pricing](https://azure.microsoft.com/pricing/details/cognitive-services/speech-services/)
- [OpenAI Service Pricing](https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/)
- [Speech Service Regions](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions)
- [OpenAI Model Availability](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)

---

**D365 Mobile Canvas Template v1.2.0 · Built with ❤️ by Microsoft Solution Engineering**

[License](https://github.com/microsoft/Copilot-Studio-Chat-PCF-Control-with-Voice/blob/main/LICENSE) · [Security](https://github.com/microsoft/Copilot-Studio-Chat-PCF-Control-with-Voice/blob/main/SECURITY.md)
