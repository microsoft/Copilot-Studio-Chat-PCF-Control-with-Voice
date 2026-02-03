# Copilot Studio Chat PCF Control with Voice

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Power Platform](https://img.shields.io/badge/Power%20Platform-PCF-purple.svg)](https://docs.microsoft.com/en-us/powerapps/developer/component-framework/overview)

> ⚠️ **DISCLAIMER**: This repository is provided for **demonstration and educational purposes only**. It is not an officially supported Microsoft product. Use of this code is at your own risk. Microsoft makes no warranties, express or implied, and assumes no liability for any issues arising from the use of this repository in production environments.

A Power Apps Component Framework (PCF) control that enables rich chat experiences with Microsoft Copilot Studio, featuring voice input/output and adaptive card support.

## Features

- ✅ **Modern Chat UI** - Clean, responsive chat interface built with Fluent Design
- ✅ **Voice Input** - Speech-to-text using browser Web Speech API or Azure Speech Services
- ✅ **Voice Output** - Text-to-speech with Azure Neural Voices or browser fallback
- ✅ **Adaptive Cards** - Support for rich interactive cards from Copilot Studio
- ✅ **Mobile Support** - Works on iOS, Android, and desktop browsers
- ✅ **Direct Line Integration** - Connects to Copilot Studio via Direct Line API
- ✅ **Driving Mode** - Hands-free operation for field workers (Beta)

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

For premium neural voices instead of browser voices:

1. Create an Azure Speech Service resource in the [Azure Portal](https://portal.azure.com)
2. Copy your **KEY** and **REGION** from Keys and Endpoint
3. Configure the control properties:
   - **SpeechKey**: Your Speech Service key
   - **SpeechRegion**: Your region code (e.g., `eastus`)

### Available Voice Profiles

| Profile | Voice | Style | Best For |
|---------|-------|-------|----------|
| `jenny-friendly` | Jenny | Friendly | Default, warm conversations |
| `jenny-customerservice` | Jenny | Customer Service | Professional support |
| `aria-customerservice` | Aria | Customer Service | Business interactions |
| `aria-empathetic` | Aria | Empathetic | Sensitive topics |
| `guy-friendly` | Guy | Friendly | Male voice option |
| `davis-chat` | Davis | Chat | Casual conversations |
| `sara-friendly` | Sara | Friendly | Alternative female voice |

## Project Structure

```
├── CopilotChatDirectLine/          # PCF Control Source
│   ├── CopilotChatBeta/           # Beta version (latest features)
│   ├── CopilotChatGA/             # General Availability (stable)
│   └── package.json
│
├── CopilotChatPCFControl/         # Solution Package
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
