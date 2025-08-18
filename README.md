# Universal AI Chat Widget

A simple floating chat widget that works with any OpenAI-compatible API. Add AI assistance to your website with minimal setup.

## Features

- **Universal API Support**: Works with Mistral, OpenAI, OpenWebUI, and more
- **Easy Setup**: Just two files and minimal configuration
- **Advanced Citation Support**: Clickable citations with source references and metadata
- **LaTeX Math Rendering**: Automatic KaTeX integration for mathematical expressions
- **Code Highlighting**: Syntax highlighting with copy-to-clipboard functionality
- **Highly Customizable**: Extensive color, opacity, positioning, and behavior options
- **Security Features**: Domain validation, rate limiting, input sanitization
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Session Persistence**: Maintains chat history across page reloads

## Quick Start

### 1. Deploy Cloudflare Worker

1. Go to [Cloudflare Workers](https://workers.cloudflare.com/)
2. Create a new Worker and paste `cloudflare-worker.js`
3. Set environment variables:
   ```
   API_ENDPOINT=https://api.mistral.ai/v1/chat/completions
   API_KEY=your-mistral-api-key
   SYSTEM_PROMPT=You are a helpful assistant.

   # Rate Limiting (optional)
   RATE_LIMIT_REQUESTS=10          # Requests per window (default: 10)
   RATE_LIMIT_WINDOW=60            # Time window in seconds (default: 60)
   RATE_LIMIT_BURST=3              # Burst allowance (default: 3)

   # Development (optional)
   ENVIRONMENT=development         # Enables debug logging
   ```
4. Update allowed domains in worker (line 26-30):
   ```javascript
   const allowedDomains = [
     "beyondsimulations.github.io",  // Your GitHub Pages domain
     "yourdomain.com",               // Your custom domain
     // Add more domains as needed
   ];
   ```
5. Deploy and note your Worker URL

### 2. Add to Website

You can either download `floating-chat.js` or load it directly from CDN:

**Option A: Load from CDN**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Page</title>
</head>
<body>
    <!-- Your content -->
    <script src="https://cdn.jsdelivr.net/gh/beyondsimulations/web-embedded-chat@main/floating-chat.js"></script>
    <script>
        new UniversalChatWidget({
            title: 'AI Assistant',
            subtitle: 'Ask me anything!',
            primaryColor: '#ff7000',
            apiEndpoint: 'https://your-worker.workers.dev'
        });
    </script>
</body>
</html>
```

**Option B: Self-hosted**
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
            primaryColor: '#ff7000',
            apiEndpoint: 'https://your-worker.workers.dev'
        });
    </script>
</body>
</html>
```

## Configuration Options

The widget supports extensive customization options:

```javascript
new UniversalChatWidget({
    // Basic Configuration
    title: 'AI Assistant',
    welcomeMessage: 'Hello! How can I help you today?',
    placeholder: 'Type your question...',
    position: 'bottom-right',       // bottom-left, top-right, top-left

    // API Configuration
    apiEndpoint: 'https://your-worker.workers.dev',
    model: 'gpt-3.5-turbo',

    // Header Colors
    titleBackgroundColor: '#2c3532',
    titleFontColor: '#ffffff',

    // Message Colors & Opacity
    assistantColor: '#fdcd9a',
    assistantFontColor: '#2c3532',
    assistantMessageOpacity: 1.0,   // 0.0 to 1.0
    userColor: '#99bfbb',
    userFontColor: '#2c3532',
    userMessageOpacity: 1.0,        // 0.0 to 1.0

    // Interface Colors
    chatBackground: '#ffffff',
    stampColor: '#df7d7d',          // Timestamps and badges
    borderColor: '#2c3532',
    buttonIconColor: '#ffffff',
    scrollbarColor: '#d1d5db',
    inputTextColor: '#1f2937',

    // Code Block Styling
    codeBackgroundColor: '#f3f4f6',
    codeOpacity: 0.8,               // 0.0 to 1.0
    codeTextColor: '#2c3532',

    // Behavior Options
    startOpen: false,
    buttonSize: 60,
    windowWidth: 450,
    windowHeight: 600,
    showModelInfo: false,
    debug: false                    // Enable for development
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

## Advanced Features

### Citation Support

The widget automatically renders citations from API responses. When your AI model returns responses with structured source data, citations appear as clickable links `[1]`, `[2]`, etc., with a references section at the bottom of messages.

**Supported Citation Formats:**
- Structured sources in API response: `data.sources`, `data.source.sources`, `data.context.sources`
- Citation metadata including document headings and snippets
- Automatic citation link generation and reference scrolling

### LaTeX Math Rendering

Mathematical expressions are automatically rendered using KaTeX:

**Supported Delimiters:**
- Display math: `$$...$$` or `\[...\]`
- Inline math: `$...$` or `\(...\)`

**Example:**
```
The quadratic formula is $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$

For display math:
$$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$
```

### Code Highlighting

Code blocks automatically include copy-to-clipboard functionality:

**Markdown Support:**
- Inline code: `` `code` ``
- Code blocks: ``` ```code``` ```
- Headers: `# ## ###`
- Bold/italic: `**bold**` `*italic*`

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

**Rate limiting**: Check worker logs for rate limit messages. Adjust `RATE_LIMIT_*` environment variables if needed

**Common fixes**:
- Remove trailing slashes from API_ENDPOINT
- Verify API key has sufficient credits
- Check model name spelling
- For development, set `ENVIRONMENT=development` to enable debug logging
- Citations require structured source data in API responses
- LaTeX rendering requires internet connection for KaTeX CDN

## Security Features

The Cloudflare Worker includes comprehensive security measures:

- **Domain Validation**: Strict CORS policy with exact domain matching
- **Rate Limiting**: Configurable request limits with burst allowance
- **Input Sanitization**: Model name validation and message length limits
- **Secure Logging**: Prevents sensitive data exposure in production
- **HTTPS Enforcement**: Automatic protocol validation
- **Development Mode**: Separate security policies for development vs production

## Files

```
├── floating-chat.js          # Main widget with citation & LaTeX support
├── cloudflare-worker.js      # Secure API proxy with rate limiting
├── index.qmd                # Demo page
└── README.md                # This documentation
```

## License

MIT License - use this in your projects!

---

**Questions?** Check the troubleshooting section or open an issue on GitHub.
