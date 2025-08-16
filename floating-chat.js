// Floating Chat Widget for Educational Sites
// Configuration - CHANGE THIS to your Cloudflare Worker URL
const CHAT_API_ENDPOINT = "https://openwebui-proxy.YOUR-SUBDOMAIN.workers.dev";

class FloatingChatWidget {
  constructor(options = {}) {
    this.options = {
      title: options.title || "💬 Course Assistant",
      subtitle: options.subtitle || "Ask me anything!",
      welcomeMessage:
        options.welcomeMessage ||
        "Hello! How can I help you with the course material today?",
      placeholder: options.placeholder || "Type your question...",
      position: options.position || "bottom-right", // bottom-right, bottom-left
      startOpen: options.startOpen || false,
      buttonSize: options.buttonSize || 60,
      windowWidth: options.windowWidth || 380,
      windowHeight: options.windowHeight || 600,

      // Color customization options
      colors: {
        primary: options.colors?.primary || "#0f6466",
        secondary: options.colors?.secondary || "#fdcd9a",
        tertiary: options.colors?.tertiary || "#d99f7e",
        quaternary: options.colors?.quaternary || "#99bfbb",
        accent: options.colors?.accent || "#df7d7d",
        code: options.colors?.code || "#F2F0F2",
        codeline: options.colors?.codeline || "#BF4D34",
        darker: options.colors?.darker || "#2c3532",
        lighter: options.colors?.lighter || "#ffffff",
        ...options.colors,
      },

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

    // Restore state from session
    this.restoreState();

    // Start open if configured
    if (this.options.startOpen && !this.hasInteracted) {
      setTimeout(() => this.open(), 1000);
    }
  }

  injectStyles() {
    if (document.getElementById("floating-chat-styles")) return;

    const styles = document.createElement("style");
    styles.id = "floating-chat-styles";
    styles.textContent = `
      /* Chat Button */
      .floating-chat-button {
        position: fixed;
        ${this.options.position.includes("right") ? "right: 20px" : "left: 20px"};
        ${this.options.position.includes("bottom") ? "bottom: 20px" : "top: 20px"};
        width: ${this.options.buttonSize}px;
        height: ${this.options.buttonSize}px;
        border-radius: 50%;
        background: ${this.getPrimaryColor()};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        z-index: 9998;
        border: none;
        color: white;
        font-size: 28px;
      }

      .floating-chat-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }

      .floating-chat-button.chat-open {
        transform: rotate(45deg);
      }

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

      /* Typing indicator in button */
      .button-typing-indicator {
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 4px 8px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 2px;
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }

      .button-typing-indicator span {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: ${this.getPrimaryColor()};
        animation: buttonTypingDot 1.4s infinite;
      }

      .button-typing-indicator span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .button-typing-indicator span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes buttonTypingDot {
        0%, 60%, 100% {
          opacity: 0.3;
          transform: scale(0.8);
        }
        30% {
          opacity: 1;
          transform: scale(1.2);
        }
      }

      /* Message preview in button */
      .button-message-preview {
        position: absolute;
        bottom: -35px;
        left: ${this.options.position.includes("right") ? "auto" : "0"};
        right: ${this.options.position.includes("right") ? "0" : "auto"};
        background: white;
        padding: 8px 12px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        max-width: 200px;
        font-size: 14px;
        color: #4b5563;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        animation: slideIn 0.3s ease;
        pointer-events: none;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .floating-chat-button.has-preview {
        animation: subtle-bounce 2s ease-in-out infinite;
      }

      @keyframes subtle-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-3px); }
      }

      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }

      /* Chat Window */
      .floating-chat-window {
        position: fixed;
        ${this.options.position.includes("right") ? "right: 20px" : "left: 20px"};
        ${this.options.position.includes("bottom") ? "bottom: 100px" : "top: 100px"};
        width: ${this.options.windowWidth}px;
        height: ${this.options.windowHeight}px;
        max-height: calc(100vh - 120px);
        background: white;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        z-index: 9999;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
        transition: all 0.3s ease;
        font-family: system-ui, -apple-system, sans-serif;
      }

      .floating-chat-window.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      /* Header */
      .chat-header {
        background: ${this.getPrimaryColor()};
        color: white;
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
        color: white;
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

      /* Messages Area */
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        background: ${this.getColor("lighter")};
        scroll-behavior: smooth;
      }

      .chat-messages::-webkit-scrollbar {
        width: 6px;
      }

      .chat-messages::-webkit-scrollbar-track {
        background: transparent;
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
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .message.user {
        text-align: right;
      }

      .message-bubble {
        display: inline-block;
        max-width: 80%;
        padding: 0.75rem 1rem;
        border-radius: 18px;
        word-wrap: break-word;
        position: relative;
      }

      .message.user .message-bubble {
        background: ${this.getPrimaryColor()};
        color: ${this.getColor("lighter")};
        border-radius: 18px 18px 4px 18px;
        text-align: left;
      }

      .message.assistant .message-bubble {
        background: ${this.getColor("lighter")};
        border: 1px solid ${this.getColor("quaternary")}80;
        border-radius: 18px 18px 18px 4px;
        color: ${this.getColor("darker")};
      }

      .message-time {
        font-size: 0.7rem;
        color: #9ca3af;
        margin-top: 0.25rem;
      }

      .typing-indicator {
        display: inline-block;
        padding: 0.75rem 1rem;
        background: ${this.getColor("lighter")};
        border: 1px solid ${this.getColor("quaternary")}80;
        border-radius: 18px;
      }

      .typing-indicator span {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${this.getColor("quaternary")};
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
        background: ${this.getColor("lighter")};
        border-top: 1px solid ${this.getColor("quaternary")}80;
        border-radius: 0 0 16px 16px;
      }

      .chat-input-container {
        display: flex;
        gap: 0.5rem;
      }

      .chat-input {
        flex: 1;
        padding: 0.75rem;
        border: 1px solid ${this.getColor("quaternary")}80;
        border-radius: 12px;
        resize: none;
        font-family: inherit;
        font-size: 0.95rem;
        line-height: 1.4;
        max-height: 100px;
      }

      .chat-input:focus {
        outline: none;
        border-color: ${this.getPrimaryColor()};
        box-shadow: 0 0 0 3px ${this.getPrimaryColor()}20;
      }

      .chat-send-btn {
        padding: 0.75rem;
        background: ${this.getPrimaryColor()};
        color: ${this.getColor("lighter")};
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
        box-shadow: 0 2px 8px ${this.getPrimaryColor()}40;
      }

      .chat-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Mobile Responsive */
      @media (max-width: 480px) {
        .floating-chat-window {
          width: calc(100vw - 40px);
          height: calc(100vh - 120px);
          right: 20px !important;
          left: 20px !important;
          bottom: 100px !important;
        }

        .floating-chat-button {
          ${this.options.buttonSize > 50 ? "width: 50px; height: 50px;" : ""}
        }
      }

      /* Markdown Support */
      .message-bubble code {
        background: ${this.getColor("code")};
        padding: 0.125rem 0.25rem;
        border-radius: 3px;
        font-family: monospace;
        font-size: 0.9em;
        color: ${this.getColor("codeline")};
      }

      .message.user .message-bubble code {
        background: rgba(255, 255, 255, 0.2);
        color: ${this.getColor("lighter")};
      }

      .message-bubble pre {
        background: ${this.getColor("darker")};
        color: ${this.getColor("code")};
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

      /* Welcome message style */
      .welcome-bubble {
        background: linear-gradient(135deg, ${this.getPrimaryColor()}15, ${this.getPrimaryColor()}05);
        border: 1px solid ${this.getPrimaryColor()}30;
      }
    `;

    document.head.appendChild(styles);
  }

  getPrimaryColor() {
    return this.options.colors.primary;
  }

  getColor(colorName) {
    return this.options.colors[colorName] || this.options.colors.primary;
  }

  createWidget() {
    // Create chat button
    this.button = document.createElement("button");
    this.button.className = "floating-chat-button";
    this.button.innerHTML = "💬";
    this.button.setAttribute("aria-label", "Open chat");

    // Create unread badge (hidden initially)
    this.unreadBadge = document.createElement("span");
    this.unreadBadge.className = "chat-unread-badge";
    this.unreadBadge.style.display = "none";
    this.button.appendChild(this.unreadBadge);

    // Create typing indicator for button (hidden initially)
    this.buttonTypingIndicator = document.createElement("div");
    this.buttonTypingIndicator.className = "button-typing-indicator";
    this.buttonTypingIndicator.innerHTML = `
      <span></span><span></span><span></span>
    `;
    this.buttonTypingIndicator.style.display = "none";
    this.button.appendChild(this.buttonTypingIndicator);

    // Create chat window
    this.window = document.createElement("div");
    this.window.className = "floating-chat-window";
    this.window.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-info">
          <h3>${this.options.title}</h3>
          <p>${this.options.subtitle}</p>
        </div>
        <div class="chat-header-actions">
          <button class="chat-header-btn chat-minimize-btn" aria-label="Minimize">−</button>
          <button class="chat-header-btn chat-clear-btn" aria-label="Clear chat">🔄</button>
          <button class="chat-header-btn chat-close-btn" aria-label="Close">×</button>
        </div>
      </div>
      <div class="chat-messages">
        <div class="message assistant">
          <div class="message-bubble welcome-bubble">
            ${this.options.welcomeMessage}
          </div>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Add to page
    document.body.appendChild(this.button);
    document.body.appendChild(this.window);

    // Get elements
    this.messagesEl = this.window.querySelector(".chat-messages");
    this.inputEl = this.window.querySelector(".chat-input");
    this.sendBtn = this.window.querySelector(".chat-send-btn");
  }

  bindEvents() {
    // Toggle chat
    this.button.addEventListener("click", () => this.toggle());

    // Window controls
    this.window
      .querySelector(".chat-close-btn")
      .addEventListener("click", () => this.close());
    this.window
      .querySelector(".chat-minimize-btn")
      .addEventListener("click", () => this.close());
    this.window
      .querySelector(".chat-clear-btn")
      .addEventListener("click", () => this.clearChat());

    // Send message
    this.sendBtn.addEventListener("click", () => this.sendMessage());

    // Input handling
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

    // Handle escape key
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
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.hasInteracted = true;
    this.window.classList.add("open");
    this.button.classList.add("chat-open");
    this.button.innerHTML = "✕";
    this.unreadCount = 0;
    this.updateUnreadBadge();
    this.hideMessagePreview(); // Clear any message preview
    this.buttonTypingIndicator.style.display = "none"; // Hide typing indicator
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

    // Add user message
    this.addMessage("user", message);

    // Clear input
    this.inputEl.value = "";
    this.autoResizeInput();
    this.sendBtn.disabled = true;

    // Show typing
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

      // Update history
      this.history.push(
        { role: "user", content: message },
        { role: "assistant", content: data.response },
      );

      // Hide typing and add response
      this.hideTyping();
      this.addMessage("assistant", data.response);

      // If chat is closed, show preview and update unread
      if (!this.isOpen) {
        this.unreadCount++;
        this.updateUnreadBadge();
        this.showMessagePreview(data.response);

        // Add attention-getting animation
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

  showTyping() {
    // Show typing in chat window
    const typingEl = document.createElement("div");
    typingEl.className = "message assistant";
    typingEl.id = "typing-indicator";
    typingEl.innerHTML = `
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    `;
    this.messagesEl.appendChild(typingEl);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    // Show typing in button if chat is closed
    if (!this.isOpen) {
      this.buttonTypingIndicator.style.display = "flex";
      // Add subtle animation to button
      this.button.classList.add("has-preview");
    }
  }

  hideTyping() {
    // Hide typing in chat window
    const typingEl = document.getElementById("typing-indicator");
    if (typingEl) typingEl.remove();

    // Hide typing in button
    this.buttonTypingIndicator.style.display = "none";
    this.button.classList.remove("has-preview");
  }

  showMessagePreview(message) {
    // Show a preview of the message when chat is closed
    if (!this.isOpen && message) {
      // Remove existing preview
      this.hideMessagePreview();

      // Create new preview
      const preview = document.createElement("div");
      preview.className = "button-message-preview";
      preview.id = "message-preview";

      // Truncate message for preview
      const truncated =
        message.length > 50 ? message.substring(0, 50) + "..." : message;
      preview.textContent = truncated;

      this.button.appendChild(preview);

      // Auto-hide after 5 seconds
      this.previewTimeout = setTimeout(() => {
        this.hideMessagePreview();
      }, 5000);
    }
  }

  hideMessagePreview() {
    const preview = document.getElementById("message-preview");
    if (preview) preview.remove();
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
    }
  }

  clearChat() {
    this.history = [];
    this.messagesEl.innerHTML = `
      <div class="message assistant">
        <div class="message-bubble welcome-bubble">
          ${this.options.welcomeMessage}
        </div>
        <div class="message-time">${this.formatTime(new Date())}</div>
      </div>
    `;
    this.saveState();
  }

  updateUnreadBadge() {
    if (this.unreadCount > 0) {
      this.unreadBadge.textContent = this.unreadCount;
      this.unreadBadge.style.display = "block";
    } else {
      this.unreadBadge.style.display = "none";
    }
  }

  saveState() {
    sessionStorage.setItem(
      "chatWidgetState",
      JSON.stringify({
        history: this.history,
        hasInteracted: this.hasInteracted,
      }),
    );
  }

  restoreState() {
    const saved = sessionStorage.getItem("chatWidgetState");
    if (saved) {
      const state = JSON.parse(saved);
      this.history = state.history || [];
      this.hasInteracted = state.hasInteracted || false;

      // Restore messages
      if (this.history.length > 0) {
        this.messagesEl.innerHTML = `
          <div class="message assistant">
            <div class="message-bubble welcome-bubble">
              ${this.options.welcomeMessage}
            </div>
            <div class="message-time">Earlier</div>
          </div>
        `;

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

// Auto-initialize if data attribute is present
document.addEventListener("DOMContentLoaded", () => {
  const autoInit = document.querySelector("[data-chat-widget]");
  if (autoInit) {
    const options = autoInit.dataset.chatWidget
      ? JSON.parse(autoInit.dataset.chatWidget)
      : {};
    window.chatWidget = new FloatingChatWidget(options);
  }
});

// Export for manual initialization
window.FloatingChatWidget = FloatingChatWidget;
