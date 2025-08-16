# Universal AI Chat Widget

A simple floating chat widget that works with any OpenAI-compatible API. Add AI assistance to your website with minimal setup.

## Features

- **Universal API Support**: Works with Mistral, OpenAI, Anthropic, OpenWebUI, Ollama, and more
- **Easy Setup**: Just two files and minimal configuration
- **Customizable**: Colors, positioning, and behavior options
- **Secure**: API keys stay safe in your backend proxy
- **Responsive**: Works on desktop and mobile

## Quick Start

### 1. Deploy Cloudflare Worker

1. Go to [Cloudflare Workers](https://workers.cloudflare.com/)
2. Create a new Worker and paste `cloudflare-worker.js`
3. Set environment variables:
   ```
   API_ENDPOINT=https://api.mistral.ai/v1/chat/completions
   API_KEY=your-mistral-api-key
   MODEL=mistral-small-latest
   SYSTEM_PROMPT=You are a helpful assistant.
   ```
4. Update allowed domains in worker:
   ```javascript
   const allowedDomains = [
     "yourdomain.com",
     "github.io",
     "localhost"
   ];
   ```
5. Deploy and note your Worker URL

### 2. Add to Website

```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Page</title>
</head>
<body>
    <!-- Your content -->
    <script src="floating-chat.js"></script>
    <script>
        new UniversalChatWidget({
            title: 'AI Assistant',
            subtitle: 'Ask me anything!',
            primaryColor: '#ff7000'
        });
    </script>
</body>
</html>
```

Update `CHAT_API_ENDPOINT` in `floating-chat.js`:
```javascript
const CHAT_API_ENDPOINT = "https://your-worker.workers.dev";
```

## Configuration Options

```javascript
new UniversalChatWidget({
    title: 'AI Assistant',
    subtitle: 'Powered by Mistral',
    welcomeMessage: 'Hello! How can I help?',
    placeholder: 'Type your question...',
    primaryColor: '#ff7000',        // Main color
    secondaryColor: '#e55a00',      // Gradient color
    position: 'bottom-right',       // bottom-left, top-right, top-left
    startOpen: false,               // Auto-open on load
    buttonSize: 60,                 // Button size in pixels
    windowWidth: 380,               // Chat window width
    windowHeight: 600               // Chat window height
});
```

## API Providers

### Mistral
```
API_ENDPOINT=https://api.mistral.ai/v1/chat/completions
API_KEY=your-mistral-key
MODEL=mistral-small-latest
```

### OpenAI
```
API_ENDPOINT=https://api.openai.com/v1/chat/completions
API_KEY=sk-your-openai-key
MODEL=gpt-3.5-turbo
```

### OpenWebUI
```
API_ENDPOINT=https://your-openwebui.com/api/chat/completions
API_KEY=your-key
MODEL=llama3.2:latest
```

## Troubleshooting

**Widget doesn't appear**: Check browser console for JavaScript errors

**API errors**:
1. Test your endpoint with curl first:
   ```bash
   curl -X POST "https://api.mistral.ai/v1/chat/completions" \
     -H "Authorization: Bearer your-key" \
     -H "Content-Type: application/json" \
     -d '{"model":"mistral-small-latest","messages":[{"role":"user","content":"test"}],"max_tokens":10}'
   ```
2. Verify environment variables in Cloudflare Workers dashboard
3. Check worker logs for detailed error messages

**CORS issues**: Add your domain to `allowedDomains` array in worker

**Common fixes**:
- Remove trailing slashes from API_ENDPOINT
- Verify API key has sufficient credits
- Check model name spelling

## Files

```
├── floating-chat.js          # Main widget (client-side)
├── cloudflare-worker.js      # API proxy (serverless)
├── configuration.js          # Example configurations
└── README.md                # This file
```

## License

MIT License - use this in your projects!

---

**Questions?** Check the troubleshooting section or open an issue on GitHub.
