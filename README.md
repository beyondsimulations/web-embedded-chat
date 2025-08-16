# OpenWebUI Embedded Chat Widget

A floating chat widget that integrates with OpenWebUI to provide AI-powered assistance on educational websites and documentation sites. Perfect for course materials, tutorials, and interactive learning platforms.

## Features

- 🎨 **Customizable Appearance**: Modern color palette with full customization options and flexible positioning
- **Persistent Sessions**: Maintains chat history across page reloads
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Smart Notifications**: Unread message badges and preview popups
- **Real-time Typing**: Shows typing indicators for better UX
- **Secure Backend**: Cloudflare Worker proxy with CORS protection
- **Easy Integration**: Simple JavaScript configuration for any website

## Quick Start

### 1. Deploy the Cloudflare Worker

1. **Create a Cloudflare Worker**:
   - Go to [Cloudflare Workers](https://workers.cloudflare.com/)
   - Create a new Worker
   - Replace the default code with the contents of `cloudflare-worker.js`

2. **Configure Environment Variables** in your Cloudflare Worker:
   ```
   OPENWEBUI_ENDPOINT=https://your-openwebui-instance.com/api/chat/completions
   OPENWEBUI_API_KEY=your-openwebui-api-key
   OPENWEBUI_MODEL=llama3.2:latest (optional)
   SYSTEM_PROMPT=Your custom system prompt (optional)
   ```

3. **Update CORS Origins** in `cloudflare-worker.js`:
   ```javascript
   const allowedOrigins = [
     "https://yourdomain.com",
     "https://*.yourdomain.com",
     "http://localhost:3000", // For local development
   ];
   ```

4. **Deploy the Worker** and note your Worker URL (e.g., `https://your-worker.your-subdomain.workers.dev`)

### 2. Configure the Frontend

1. **Update the API Endpoint** in `floating-chat.js`:
   ```javascript
   const CHAT_API_ENDPOINT = "https://your-worker.your-subdomain.workers.dev";
   ```

2. **Host the JavaScript Files** on your website or CDN

### 3. Add to Your Website

#### Option A: Direct HTML Integration

```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Page</title>
</head>
<body>
    <!-- Your content here -->

    <!-- Add the chat widget -->
    <script src="/path/to/floating-chat.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            new FloatingChatWidget({
                title: 'Course Assistant',
                subtitle: 'Ask me anything!',
                position: 'bottom-right',
                startOpen: false,
                // Custom colors
                colors: {
                    primary: '#003d82', //  blue
                    accent: '#ffd100', //  gold
                }
            });
        });
    </script>
</body>
</html>
```

#### Option B: Quarto Integration

Add to your `_quarto.yml`:

```yaml
format:
  html:
    include-after-body:
      - text: |
          <script src="/floating-chat.js"></script>
          <script>
            document.addEventListener('DOMContentLoaded', () => {
              new FloatingChatWidget({
                  title: 'Course Helper',
                  // Uses modern default colors
              });
            });
          </script>
```

Or use the configuration file approach shown in `configuration.js`.

## Configuration Options

### Widget Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | String | "💬 Course Assistant" | Chat window title |
| `subtitle` | String | "Ask me anything!" | Subtitle text |
| `welcomeMessage` | String | "Hello! How can I help..." | Initial message |
| `placeholder` | String | "Type your question..." | Input placeholder |
| `position` | String | "bottom-right" | Widget position (`bottom-right`, `bottom-left`, `top-right`, `top-left`) |
| `colors` | Object | Modern palette | Custom color configuration (see color options below) |
| `startOpen` | Boolean | false | Open automatically on page load |
| `buttonSize` | Number | 60 | Size of the floating button in pixels |
| `windowWidth` | Number | 380 | Chat window width in pixels |
| `windowHeight` | Number | 600 | Chat window height in pixels |

### Color Customization

The widget uses a modern color palette by default. You can override any colors:

| Color | Default | Purpose |
|-------|---------|---------|
| `primary` | "#0f6466" | Main brand color (button, header, user messages) |
| `secondary` | "#fdcd9a" | Secondary accent color |
| `tertiary` | "#d99f7e" | Tertiary accent color |
| `quaternary` | "#99bfbb" | Borders and subtle elements |
| `accent` | "#df7d7d" | Highlight color |
| `code` | "#F2F0F2" | Code block backgrounds |
| `codeline` | "#BF4D34" | Code text color |
| `darker` | "#2c3532" | Dark text and backgrounds |
| `lighter` | "#ffffff" | Light backgrounds and text |

### Example Configurations

**Educational Site**:
```javascript
new FloatingChatWidget({
    title: 'Study Assistant',
    subtitle: 'Available 24/7',
    welcomeMessage: 'Hi! I can help explain course concepts and answer questions.',
    placeholder: 'Ask about the course material...',
    // Uses modern default colors
});
```

**Documentation Site**:
```javascript
new FloatingChatWidget({
    title: 'API Helper',
    subtitle: 'Documentation Assistant',
    position: 'bottom-left',
    welcomeMessage: 'Need help with the API? I can assist with code examples and explanations.',
    colors: {
        primary: '#1a1a2e', // Dark blue
        quaternary: '#16213e', // Darker borders
        lighter: '#f8f9fa', // Clean white
    }
});
```

## OpenWebUI Setup

### Prerequisites

1. **Running OpenWebUI Instance**: You need a deployed OpenWebUI instance with API access
2. **API Key**: Generate an API key from your OpenWebUI admin panel
3. **Model Access**: Ensure your chosen model is available and loaded

## Customization

### Styling

The widget uses CSS custom properties that you can override:

```css
/* Override specific colors globally */
:root {
    --chat-primary: #your-brand-color;
    --chat-accent: #your-accent-color;
}
```

Or customize colors through the JavaScript configuration:

```javascript
new FloatingChatWidget({
    colors: {
        primary: '#your-brand-color',
        secondary: '#your-secondary',
        // Only override the colors you want to change
    }
});
```

### System Prompts

Customize the AI behavior by setting the `SYSTEM_PROMPT` environment variable:

```
You are a helpful course assistant for a computer science program.
Focus on helping students understand concepts rather than giving direct answers.
Ask clarifying questions and guide them to discover solutions.
```

## Security Considerations

- **CORS Protection**: Configurable allowed origins
- **Input Validation**: Message length and format validation
- **Rate Limiting**: Implement rate limiting in your OpenWebUI instance
- **API Key Security**: Environment variables keep keys secure
- **Domain Restrictions**: Always configure `allowedOrigins` for production

### Debug Mode

Enable debug logging by adding to your configuration:

```javascript
new FloatingChatWidget({
    // ... other options
    debug: true  // Enables console logging
});
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for integration with [OpenWebUI](https://github.com/open-webui/open-webui)
- Designed for educational and documentation websites
- Inspired by modern chat widget UX patterns

---

**Need help?** Open an issue or check the [troubleshooting section](#troubleshooting) above.
