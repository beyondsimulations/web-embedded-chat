# Universal AI Chat Widget

A simple, floating chat widget that works with any OpenAI-compatible API. Perfect for adding AI assistance to your website with minimal setup.

## Features

- **Universal API Support**: Works with any OpenAI-compatible API (OpenAI, Anthropic, OpenWebUI, Ollama, Azure OpenAI, etc.)
- **Customizable Appearance**: Easy color customization and flexible positioning
- **Persistent Chat History**: Maintains conversations across page reloads
- **Responsive Design**: Works on desktop and mobile
- **Real-time Typing Indicators**: Better user experience
- **Secure**: Cloudflare Worker proxy keeps API keys safe
- **Easy Setup**: Just two files and minimal configuration

## Quick Start

### 1. Deploy the Cloudflare Worker

1. Go to [Cloudflare Workers](https://workers.cloudflare.com/)
2. Create a new Worker
3. Replace the default code with the contents of `cloudflare-worker.js`
4. Set these environment variables:
   ```
   API_ENDPOINT=https://api.openai.com/v1/chat/completions
   API_KEY=your-api-key-here
   MODEL=gpt-3.5-turbo
   SYSTEM_PROMPT=You are a helpful assistant.
   ```
5. Update the allowed domains in the worker code:
   ```javascript
   const allowedDomains = [
     "yourdomain.com",
     "github.io",
     "localhost"
   ];
   ```
6. Deploy and note your Worker URL

### 2. Add to Your Website

1. Download `floating-chat.js`
2. Update the API endpoint at the top of the file:
   ```javascript
   const CHAT_API_ENDPOINT = "https://your-worker.workers.dev";
   ```
3. Add to your HTML:

#### Manual Initialization
```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Page</title>
</head>
<body>
    <!-- Your content here -->
    
    <script src="floating-chat.js"></script>
    <script>
        new UniversalChatWidget({
            title: 'AI Assistant',
            subtitle: 'Ask me anything!',
            primaryColor: '#3b82f6'
        });
    </script>
</body>
</html>
```

#### Auto-Initialization
Alternatively, use the `data-chat-widget` attribute for automatic initialization:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Page</title>
</head>
<body data-chat-widget='{"title": "AI Assistant", "primaryColor": "#3b82f6"}'>
    <!-- Your content here -->
    
    <script src="floating-chat.js"></script>
    <!-- Widget initializes automatically -->
</body>
</html>
```

## Configuration Options

### Basic Options
```javascript
new UniversalChatWidget({
    // Text
    title: 'AI Assistant',
    subtitle: 'Powered by AI',
    welcomeMessage: 'Hello! How can I help you today?',
    placeholder: 'Type your question...',
    
    // Appearance
    primaryColor: '#3b82f6',           // Main color (button, user messages)
    secondaryColor: '#1d4ed8',         // Optional gradient color
    textColor: '#ffffff',              // Text on colored backgrounds
    backgroundColor: '#ffffff',        // Chat background
    userMessageColor: null,            // Defaults to primaryColor
    assistantMessageColor: '#ffffff',  // AI message background
    assistantBorderColor: '#e5e7eb',  // AI message border
    
    // Behavior
    position: 'bottom-right',          // bottom-right, bottom-left, top-right, top-left
    startOpen: false,                  // Open automatically
    buttonSize: 60,                    // Button size in pixels
    windowWidth: 380,                  // Chat window width
    windowHeight: 600,                 // Chat window height
    showModelInfo: false,              // Show model info in chat
    debug: false,                      // Enable debug logging
});
```

## API Provider Examples

### OpenAI
```
API_ENDPOINT=https://api.openai.com/v1/chat/completions
API_KEY=sk-your-openai-key
MODEL=gpt-3.5-turbo
```

### Anthropic Claude
```
API_ENDPOINT=https://api.anthropic.com/v1/messages
API_KEY=sk-ant-your-key
MODEL=claude-3-sonnet-20240229
```

### OpenWebUI
```
API_ENDPOINT=https://your-openwebui.com/api/chat/completions
API_KEY=your-openwebui-key
MODEL=llama3.2:latest
```

### Ollama (Local)
```
API_ENDPOINT=http://localhost:11434/api/chat
API_KEY=not-required
MODEL=llama3.2:latest
```

### Azure OpenAI
```
API_ENDPOINT=https://your-resource.openai.azure.com/openai/deployments/your-model/chat/completions?api-version=2024-02-15-preview
API_KEY=your-azure-key
MODEL=gpt-35-turbo
```

## Example Configurations

### Educational Site
```javascript
new UniversalChatWidget({
    title: 'Study Helper',
    subtitle: 'Get help with your coursework',
    primaryColor: '#059669',
    welcomeMessage: 'Hi! I can help explain concepts, solve problems, and answer questions about your studies.'
});
```

### Documentation Site
```javascript
new UniversalChatWidget({
    title: 'Doc Assistant',
    subtitle: 'Ask about our docs',
    primaryColor: '#7c3aed',
    position: 'bottom-left',
    welcomeMessage: 'Need help navigating our documentation? Ask me anything!'
});
```

### Corporate Site
```javascript
new UniversalChatWidget({
    title: 'Support',
    subtitle: 'How can we help?',
    primaryColor: '#dc2626',
    secondaryColor: '#991b1b',
    backgroundColor: '#f9fafb'
});
```

## Development

### Local Testing
1. Start a local web server: `python -m http.server 3000`
2. Add `localhost` to your worker's allowed domains
3. Open `http://localhost:3000` and test

### File Structure
```
├── floating-chat.js      # Main widget (client-side)
├── cloudflare-worker.js  # API proxy (server-side)
├── configuration.js      # Example configurations
└── README.md            # This file
```

## Troubleshooting

**Widget doesn't appear**: Check browser console for errors, verify script path is correct

**API errors**: 
- Verify your Worker URL in `CHAT_API_ENDPOINT`
- Check environment variables in Cloudflare Workers dashboard
- Confirm API key is valid and has credits
- Make sure your domain is in the `allowedDomains` list

**CORS issues**: Add your domain to the `allowedDomains` array in the worker code

## Security

- API keys are stored securely in Cloudflare Workers environment variables
- CORS protection limits which domains can use your worker
- Input validation prevents oversized messages
- No API keys or sensitive data in client-side code

## License

MIT License - feel free to use this in your projects!

---

**Questions?** Open an issue on GitHub or check the troubleshooting section above.