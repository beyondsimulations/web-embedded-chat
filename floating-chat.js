// Universal Chat Widget - Works with any OpenAI-compatible API

class UniversalChatWidget {
  constructor(options = {}) {
    this.options = {
      title: options.title || "Course Assistant",
      welcomeMessage:
        options.welcomeMessage || "Hello! How can I help you today?",
      placeholder: options.placeholder || "Type your question...",
      position: options.position || "bottom-right", // bottom-right, bottom-left, top-right, top-left

      // API Configuration with validation
      apiEndpoint:
        this.validateApiEndpoint(options.apiEndpoint) ||
        "https://your-worker.workers.dev",
      model: this.validateModel(options.model) || "gpt-3.5-turbo", // Model to use for API requests

      // Main theme colors
      primaryColor: options.primaryColor || "#0f6466", // Main brand color (user messages, buttons)
      secondaryColor: options.secondaryColor || "#99bfbb", // Hover states, focus rings, accents
      backgroundColor: options.backgroundColor || "#ffffff", // Window background
      headerBackgroundColor: options.headerBackgroundColor || "#2c3532", // Header background (both title and subtitle rows)

      // Message styling
      userMessageColor: options.userMessageColor || "#99bfbb", // User message bubbles
      assistantMessageColor: options.assistantMessageColor || "#fdcd9a", // Assistant message bubbles
      messageBorderColor: options.messageBorderColor || "#2c3532", // Border for both message types
      userMessageOpacity: options.userMessageOpacity || 1.0, // Opacity for user message bubbles (0.0 to 1.0)
      assistantMessageOpacity: options.assistantMessageOpacity || 1.0, // Opacity for assistant message bubbles (0.0 to 1.0)

      // Text colors
      textColor: options.textColor || "#ffffff", // Text on colored backgrounds (buttons)
      headerTextColor: options.headerTextColor || "#ffffff", // Text in header (title)
      userTextColor: options.userTextColor || "#2c3532", // Text in user message bubbles
      assistantTextColor: options.assistantTextColor || "#2c3532", // Text in assistant message bubbles
      mutedTextColor: options.mutedTextColor || "#99bfbb", // Timestamps, secondary text

      // Behavior options
      startOpen: options.startOpen || false,
      buttonSize: options.buttonSize || 60,
      windowWidth: options.windowWidth || 450,
      windowHeight: options.windowHeight || 600,
      showModelInfo: options.showModelInfo || false,

      // Debug mode (enable for development)
      debug: false,

      ...options,
    };

    this.isOpen = false;
    this.history = [];
    this.unreadCount = 0;
    this.hasInteracted = false;

    this.init();
  }

  validateApiEndpoint(endpoint) {
    if (!endpoint) return null;
    try {
      const url = new URL(endpoint);
      if (!["https:", "http:"].includes(url.protocol)) {
        console.warn("Chat Widget: Only HTTP/HTTPS endpoints allowed");
        return null;
      }
      return endpoint;
    } catch (e) {
      console.warn("Chat Widget: Invalid API endpoint provided");
      return null;
    }
  }

  validateModel(model) {
    if (!model || typeof model !== "string") return null;
    // Allow alphanumeric, hyphens, underscores, and dots only
    if (!/^[a-zA-Z0-9\-_.]+$/.test(model)) {
      console.warn("Chat Widget: Invalid model name provided");
      return null;
    }
    return model.substring(0, 50); // Limit length
  }

  init() {
    this.injectStyles();
    this.createWidget();
    this.bindEvents();
    this.restoreState();

    if (this.options.startOpen && !this.hasInteracted) {
      setTimeout(() => this.open(), 1000);
    }
  }

  injectStyles() {
    if (document.getElementById("universal-chat-styles")) return;

    // Use solid color only - no gradients
    const backgroundStyle = this.options.primaryColor;
    const headerBackgroundStyle = this.options.headerBackgroundColor;

    const styles = document.createElement("style");
    styles.id = "universal-chat-styles";
    styles.textContent = `
      /* Chat Button */
      .universal-chat-button {
        position: fixed;
        ${this.options.position.includes("right") ? "right: 20px" : "left: 20px"};
        ${this.options.position.includes("bottom") ? "bottom: 20px" : "top: 20px"};
        width: ${this.options.buttonSize}px;
        height: ${this.options.buttonSize}px;
        border-radius: 4px;
        background: ${backgroundStyle};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        z-index: 9998;
        border: none;
        color: ${this.options.textColor};
        font-size: 28px;
      }

      .universal-chat-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        background: ${this.options.secondaryColor};
      }

      .universal-chat-button.chat-open {
        transform: rotate(90deg);
      }

      /* Unread Badge */
      .chat-unread-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #ef4444;
        color: white;
        border-radius: 6px;
        padding: 2px 6px;
        font-size: 12px;
        font-weight: bold;
        min-width: 20px;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      /* Typing Indicator in Button */
      .button-typing-indicator {
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        background: ${this.options.backgroundColor};
        padding: 4px 8px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 2px;
        animation: slideUp 0.3s ease;
      }

      .button-typing-indicator span {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: ${this.options.primaryColor};
        animation: typingDot 1.4s infinite;
      }

      .button-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
      .button-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

      @keyframes typingDot {
        0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
        30% { opacity: 1; transform: scale(1.2); }
      }

      /* Message Preview */
      .button-message-preview {
        position: absolute;
        bottom: -35px;
        ${this.options.position.includes("right") ? "right: 0" : "left: 0"};
        background: ${this.options.backgroundColor};
        padding: 8px 12px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        max-width: 250px;
        font-size: 14px;
        color: #4b5563;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        animation: slideIn 0.3s ease;
      }

      /* Chat Window */
      .universal-chat-window {
        position: fixed;
        ${this.options.position.includes("right") ? "right: 20px" : "left: 20px"};
        ${this.options.position.includes("bottom") ? "bottom: 100px" : "top: 100px"};
        width: ${this.options.windowWidth}px;
        height: ${this.options.windowHeight}px;
        max-height: calc(100vh - 120px);
        background: ${this.options.backgroundColor};
        border-radius: 4px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        z-index: 9999;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
        transition: all 0.3s ease;
        font-family: inherit;

      }

      .universal-chat-window.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      /* Header */
      .chat-header {
        background: ${headerBackgroundStyle};
        color: ${this.options.headerTextColor};
        padding: 0.5rem 1.25rem;
        border-radius: 4px 4px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .chat-header-info h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: ${this.options.headerTextColor};
      }

      .chat-header-actions {
        display: flex;
        gap: 0.5rem;
      }

      .chat-header-btn {
        background: none;
        border: none;
        color: ${this.options.headerTextColor};
        width: 44px;
        height: 44px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s;
        font-size: 28px;
      }

      .chat-header-btn:hover {
        opacity: 0.7;
      }

      /* Messages */
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        padding-bottom: 100px;
        background: #f9fafb;
        scroll-behavior: smooth;
      }

      .chat-messages::-webkit-scrollbar {
        width: 6px;
      }

      .chat-messages::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 3px;
      }

      .message {
        margin-bottom: 1rem;
        animation: messageSlide 0.3s ease;
      }

      @keyframes messageSlide {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .message.user { text-align: right; }

      .message-bubble {
        display: inline-block;
        max-width: 80%;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        word-wrap: break-word;
      }

      .message.user .message-bubble {
        background: color-mix(in srgb, ${this.options.userMessageColor}, transparent ${(1 - this.options.userMessageOpacity) * 100}%);
        border: 1px solid ${this.options.messageBorderColor};
        color: ${this.options.userTextColor};
        border-radius: 8px 8px 4px 8px;
        text-align: left;
      }

      .message.assistant .message-bubble {
        background: color-mix(in srgb, ${this.options.assistantMessageColor}, transparent ${(1 - this.options.assistantMessageOpacity) * 100}%);
        border: 1px solid ${this.options.messageBorderColor};
        border-radius: 8px 8px 8px 4px;
        color: ${this.options.assistantTextColor};
      }

      .message-time {
        font-size: 0.7rem;
        color: ${this.options.mutedTextColor || "#9ca3af"};
        margin-top: 0.25rem;
      }

      .typing-indicator {
        display: inline-block;
        padding: 0.75rem 1rem;
        background: color-mix(in srgb, ${this.options.assistantMessageColor}, transparent ${(1 - this.options.assistantMessageOpacity) * 100}%);
        border: 1px solid ${this.options.messageBorderColor};
        border-radius: 8px;
      }

      .typing-indicator span {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${this.options.assistantTextColor};
        margin: 0 2px;
        animation: typingBounce 1.4s infinite;
      }

      .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
      .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

      @keyframes typingBounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-10px); }
      }

      /* Input Area */
      .chat-input-area {
        position: absolute;
        bottom: 1rem;
        left: 1rem;
        right: 1rem;
        background: ${this.options.backgroundColor};
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10;
      }

      .chat-input-container {
        display: flex;
        border: 1px solid ${this.options.messageBorderColor};
        border-radius: 6px;
        overflow: hidden;
        background: ${this.options.backgroundColor};
        padding: 0;
      }

      .chat-input {
        flex: 1;
        padding: 0.75rem;
        border: none;
        resize: none;
        font-family: inherit;
        font-size: 0.95rem;
        line-height: 1.4;
        max-height: 100px;
        background: transparent;
        color: #1f2937;
      }

      .chat-input:focus {
        outline: none;
      }

      .chat-input-container:focus-within {
        box-shadow: 0 0 0 6px ${this.options.secondaryColor}20;
      }

      .chat-send-btn {
        padding: 0.75rem 1rem;
        background: ${backgroundStyle};
        color: ${this.options.textColor};
        border: none;
        border-left: 1px solid ${this.options.messageBorderColor};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        font-size: inherit;
        font-family: inherit;
        font-weight: 500;
        white-space: nowrap;
      }

      .chat-send-btn:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow: 0 2px 8px ${this.options.secondaryColor}40;
        background: ${this.options.secondaryColor};
      }

      .chat-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Model info badge */
      .model-info {
        font-size: 0.7rem;
        color: ${this.options.mutedTextColor || "#9ca3af"};
        text-align: center;
        padding: 0.25rem;
        background: #f3f4f6;
        margin: 0 1rem;
        border-radius: 4px;
      }

      /* Mobile */
      @media (max-width: 480px) {
        .universal-chat-window {
          width: calc(100vw - 40px);
          height: calc(100vh - 120px);
        }
      }

      /* Markdown support */
      .message-bubble code {
        background: ${this.options.primaryColor}15;
        padding: 0.125rem 0.25rem;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 0.9em;
        color: #1f2937;
      }

      .message.user .message-bubble code {
        background: rgba(255, 255, 255, 0.2);
        color: ${this.options.userTextColor};
      }

      .message-bubble pre {
        background: #1e293b;
        color: #e2e8f0;
        padding: 0.75rem;
        border-radius: 8px;
        overflow-x: auto;
        margin: 0.5rem 0;
      }

      .message-bubble pre code {
        background: transparent;
        padding: 0;
        color: inherit;
      }

      /* Animations */
      @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      @keyframes slideIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
    `;

    document.head.appendChild(styles);
  }

  createWidget() {
    // Create button
    this.button = document.createElement("button");
    this.button.className = "universal-chat-button";
    this.button.innerHTML = "💬";
    this.button.setAttribute("aria-label", "Open chat");

    // Add unread badge
    this.unreadBadge = document.createElement("span");
    this.unreadBadge.className = "chat-unread-badge";
    this.unreadBadge.style.display = "none";
    this.button.appendChild(this.unreadBadge);

    // Add typing indicator for button
    this.buttonTypingIndicator = document.createElement("div");
    this.buttonTypingIndicator.className = "button-typing-indicator";
    this.buttonTypingIndicator.innerHTML =
      "<span></span><span></span><span></span>";
    this.buttonTypingIndicator.style.display = "none";
    this.button.appendChild(this.buttonTypingIndicator);

    // Create window
    this.window = document.createElement("div");
    this.window.className = "universal-chat-window";
    this.window.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-info">
          <h3>${this.options.title}</h3>
        </div>
        <div class="chat-header-actions">
          <button class="chat-header-btn chat-clear-btn" title="Clear chat">↻</button>
          <button class="chat-header-btn chat-close-btn" title="Close">×</button>
        </div>
      </div>
      ${this.options.showModelInfo ? '<div class="model-info" id="model-info"></div>' : ""}
      <div class="chat-messages">
        <div class="message assistant">
          <div class="message-bubble">${this.options.welcomeMessage}</div>
          <div class="message-time">${this.formatTime(new Date())}</div>
        </div>
      </div>
      <div class="chat-input-area">
        <div class="chat-input-container">
          <textarea
            class="chat-input"
            placeholder="${this.options.placeholder}"
            maxlength="2000"
            rows="1"></textarea>
          <button class="chat-send-btn" disabled>
            Send
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.button);
    document.body.appendChild(this.window);

    this.messagesEl = this.window.querySelector(".chat-messages");
    this.inputEl = this.window.querySelector(".chat-input");
    this.sendBtn = this.window.querySelector(".chat-send-btn");
    this.modelInfoEl = this.window.querySelector("#model-info");
  }

  bindEvents() {
    this.button.addEventListener("click", () => this.toggle());
    this.window
      .querySelector(".chat-close-btn")
      .addEventListener("click", () => this.close());
    this.window
      .querySelector(".chat-clear-btn")
      .addEventListener("click", () => this.clearChat());
    this.sendBtn.addEventListener("click", () => this.sendMessage());

    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.inputEl.addEventListener("input", () => {
      this.sendBtn.disabled = !this.inputEl.value.trim();
      this.autoResizeInput();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
    });
  }

  autoResizeInput() {
    this.inputEl.style.height = "auto";
    this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 100) + "px";
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    this.hasInteracted = true;
    this.window.classList.add("open");
    this.button.classList.add("chat-open");
    this.button.innerHTML = "×";
    this.unreadCount = 0;
    this.updateUnreadBadge();
    this.hideMessagePreview();
    this.buttonTypingIndicator.style.display = "none";
    this.inputEl.focus();
    this.saveState();
  }

  close() {
    this.isOpen = false;
    this.window.classList.remove("open");
    this.button.classList.remove("chat-open");
    this.button.innerHTML = "💬";
    this.saveState();
  }

  async sendMessage() {
    const message = this.inputEl.value.trim();
    if (!message) return;

    this.addMessage("user", message);
    this.inputEl.value = "";
    this.autoResizeInput();
    this.sendBtn.disabled = true;

    this.showTyping();

    try {
      const response = await fetch(this.options.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          history: this.history.slice(-10),
          model: this.options.model,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      // Update model info if available
      if (this.modelInfoEl && data.model) {
        this.modelInfoEl.textContent = `Model: ${data.model}`;
      }

      this.history.push(
        { role: "user", content: message },
        { role: "assistant", content: data.response },
      );

      this.hideTyping();
      this.addMessage("assistant", data.response);

      if (!this.isOpen) {
        this.unreadCount++;
        this.updateUnreadBadge();
        this.showMessagePreview(data.response);
        this.button.style.animation = "pulse 0.5s ease 3";
        setTimeout(() => {
          this.button.style.animation = "";
        }, 1500);
      }

      this.saveState();
    } catch (error) {
      console.error("Chat error:", error);
      this.hideTyping();
      this.addMessage(
        "assistant",
        "⚠️ Sorry, I encountered an error. Please try again.",
      );
    }

    this.inputEl.focus();
  }

  showTyping() {
    const typingEl = document.createElement("div");
    typingEl.className = "message assistant";
    typingEl.id = "typing-indicator";
    typingEl.innerHTML =
      '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    this.messagesEl.appendChild(typingEl);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    if (!this.isOpen) {
      this.buttonTypingIndicator.style.display = "flex";
      this.button.classList.add("has-preview");
    }
  }

  hideTyping() {
    const typingEl = document.getElementById("typing-indicator");
    if (typingEl) typingEl.remove();
    this.buttonTypingIndicator.style.display = "none";
    this.button.classList.remove("has-preview");
  }

  showMessagePreview(message) {
    if (!this.isOpen && message) {
      this.hideMessagePreview();
      const preview = document.createElement("div");
      preview.className = "button-message-preview";
      preview.id = "message-preview";
      const truncated =
        message.length > 60 ? message.substring(0, 60) + "..." : message;
      preview.textContent = truncated;
      this.button.appendChild(preview);
      this.previewTimeout = setTimeout(() => this.hideMessagePreview(), 5000);
    }
  }

  hideMessagePreview() {
    const preview = document.getElementById("message-preview");
    if (preview) preview.remove();
    if (this.previewTimeout) clearTimeout(this.previewTimeout);
  }

  addMessage(type, content) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${type}`;
    const formatted = this.formatMessage(content);
    const time = this.formatTime(new Date());
    messageEl.innerHTML = `
      <div class="message-bubble">${formatted}</div>
      <div class="message-time">${time}</div>
    `;
    this.messagesEl.appendChild(messageEl);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  formatMessage(content) {
    const escaped = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return escaped
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");
  }

  formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  updateUnreadBadge() {
    if (this.unreadCount > 0) {
      this.unreadBadge.textContent = this.unreadCount;
      this.unreadBadge.style.display = "block";
    } else {
      this.unreadBadge.style.display = "none";
    }
  }

  clearChat() {
    this.history = [];
    this.messagesEl.innerHTML = `
      <div class="message assistant">
        <div class="message-bubble">${this.options.welcomeMessage}</div>
        <div class="message-time">${this.formatTime(new Date())}</div>
      </div>
    `;
    this.saveState();
  }

  saveState() {
    sessionStorage.setItem(
      "universalChatState",
      JSON.stringify({
        history: this.history,
        hasInteracted: this.hasInteracted,
      }),
    );
  }

  restoreState() {
    const saved = sessionStorage.getItem("universalChatState");
    if (saved) {
      const state = JSON.parse(saved);
      this.history = state.history || [];
      this.hasInteracted = state.hasInteracted || false;

      if (this.history.length > 0) {
        this.messagesEl.innerHTML = "";
        this.history.forEach((msg) => {
          if (msg.role !== "system") {
            this.addMessage(
              msg.role === "user" ? "user" : "assistant",
              msg.content,
            );
          }
        });
      }
    }
  }
}

// Auto-initialize
document.addEventListener("DOMContentLoaded", () => {
  const autoInit = document.querySelector("[data-chat-widget]");
  if (autoInit) {
    const options = autoInit.dataset.chatWidget
      ? JSON.parse(autoInit.dataset.chatWidget)
      : {};
    window.chatWidget = new UniversalChatWidget(options);
  }
});

window.UniversalChatWidget = UniversalChatWidget;
