// Universal Chat Widget - Works with any OpenAI-compatible API
// Configuration - CHANGE THIS to your Cloudflare Worker URL
const CHAT_API_ENDPOINT = "https://your-worker.workers.dev";

class UniversalChatWidget {
  constructor(options = {}) {
    this.options = {
      title: options.title || "AI Assistant",
      subtitle: options.subtitle || "Powered by AI",
      welcomeMessage:
        options.welcomeMessage || "Hello! How can I help you today?",
      placeholder: options.placeholder || "Type your question...",
      position: options.position || "bottom-right",
      // Color customization with defaults
      primaryColor: options.primaryColor || "#3b82f6", // Default blue
      secondaryColor: options.secondaryColor || null, // Optional gradient color
      textColor: options.textColor || "#ffffff", // Text on colored backgrounds
      backgroundColor: options.backgroundColor || "#ffffff", // Chat background
      userMessageColor: options.userMessageColor || null, // Defaults to primaryColor
      assistantMessageColor: options.assistantMessageColor || "#ffffff",
      assistantBorderColor: options.assistantBorderColor || "#e5e7eb",
      // Behavior options
      startOpen: options.startOpen || false,
      buttonSize: options.buttonSize || 60,
      windowWidth: options.windowWidth || 380,
      windowHeight: options.windowHeight || 600,
      showModelInfo: options.showModelInfo || false,
      ...options,
    };

    this.isOpen = false;
    this.history = [];
    this.unreadCount = 0;
    this.hasInteracted = false;

    this.init();
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

    // Generate gradient if secondary color provided, otherwise solid color
    const backgroundStyle = this.options.secondaryColor
      ? `linear-gradient(135deg, ${this.options.primaryColor} 0%, ${this.options.secondaryColor} 100%)`
      : this.options.primaryColor;

    // Use user message color if specified, otherwise use primary color
    const userMessageBg =
      this.options.userMessageColor || this.options.primaryColor;
    const userMessageStyle =
      this.options.secondaryColor && !this.options.userMessageColor
        ? backgroundStyle
        : userMessageBg;

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
        border-radius: 50%;
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
        border-radius: 10px;
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
        border-radius: 12px;
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
        border-radius: 12px;
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
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        z-index: 9999;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
        transition: all 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .universal-chat-window.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      /* Header */
      .chat-header {
        background: ${backgroundStyle};
        color: ${this.options.textColor};
        padding: 1.25rem;
        border-radius: 16px 16px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .chat-header-info h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
      }

      .chat-header-info p {
        margin: 0.25rem 0 0 0;
        font-size: 0.85rem;
        opacity: 0.9;
      }

      .chat-header-actions {
        display: flex;
        gap: 0.5rem;
      }

      .chat-header-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: ${this.options.textColor};
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        font-size: 18px;
      }

      .chat-header-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      /* Messages */
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
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
        border-radius: 18px;
        word-wrap: break-word;
      }

      .message.user .message-bubble {
        background: ${userMessageStyle};
        color: ${this.options.textColor};
        border-radius: 18px 18px 4px 18px;
        text-align: left;
      }

      .message.assistant .message-bubble {
        background: ${this.options.assistantMessageColor};
        border: 1px solid ${this.options.assistantBorderColor};
        border-radius: 18px 18px 18px 4px;
        color: #1f2937;
      }

      .message-time {
        font-size: 0.7rem;
        color: #9ca3af;
        margin-top: 0.25rem;
      }

      .typing-indicator {
        display: inline-block;
        padding: 0.75rem 1rem;
        background: ${this.options.assistantMessageColor};
        border: 1px solid ${this.options.assistantBorderColor};
        border-radius: 18px;
      }

      .typing-indicator span {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #9ca3af;
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
        padding: 1rem;
        background: ${this.options.backgroundColor};
        border-top: 1px solid #e5e7eb;
        border-radius: 0 0 16px 16px;
      }

      .chat-input-container {
        display: flex;
        gap: 0.5rem;
      }

      .chat-input {
        flex: 1;
        padding: 0.75rem;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        resize: none;
        font-family: inherit;
        font-size: 0.95rem;
        line-height: 1.4;
        max-height: 100px;
        background: ${this.options.backgroundColor};
        color: #1f2937;
      }

      .chat-input:focus {
        outline: none;
        border-color: ${this.options.primaryColor};
        box-shadow: 0 0 0 3px ${this.options.primaryColor}20;
      }

      .chat-send-btn {
        padding: 0.75rem;
        background: ${backgroundStyle};
        color: ${this.options.textColor};
        border: none;
        border-radius: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        width: 44px;
        height: 44px;
      }

      .chat-send-btn:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow: 0 2px 8px ${this.options.primaryColor}40;
      }

      .chat-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Model info badge */
      .model-info {
        font-size: 0.7rem;
        color: #9ca3af;
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
        color: ${this.options.textColor};
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
          <p>${this.options.subtitle}</p>
        </div>
        <div class="chat-header-actions">
          <button class="chat-header-btn chat-clear-btn" title="Clear chat">🔄</button>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
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
    this.button.innerHTML = "✕";
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
      const response = await fetch(CHAT_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          history: this.history.slice(-10),
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
