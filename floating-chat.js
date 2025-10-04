// Universal Chat Widget - Works with any OpenAI-compatible API

// ============================================================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================================================

/**
 * @typedef {Object} ChatOptions
 * Defaults are defined in _normalizeOptions().
 * @property {string} [title] - Chat window title
 * @property {string} [welcomeMessage] - Initial greeting message
 * @property {string} [placeholder] - Input placeholder text
 * @property {string} [position] - Widget position: "bottom-right" | "bottom-left" | "top-right" | "top-left"
 * @property {string} apiEndpoint - API endpoint URL for chat requests (required)
 * @property {string} [model] - AI model name
 * @property {string} [titleBackgroundColor] - Header background color
 * @property {string} [titleFontColor] - Header text color
 * @property {string} [assistantColor] - Assistant message bubble color
 * @property {string} [assistantFontColor] - Assistant text color
 * @property {number} [assistantMessageOpacity] - Assistant bubble opacity (0.0–1.0)
 * @property {string} [userColor] - User message bubble color
 * @property {string} [userFontColor] - User text color
 * @property {number} [userMessageOpacity] - User bubble opacity (0.0–1.0)
 * @property {string} [chatBackground] - Chat window background color
 * @property {string} [stampColor] - Timestamp and badge color
 * @property {string} [codeBackgroundColor] - Code block background color
 * @property {number} [codeOpacity] - Code block opacity (0.0–1.0)
 * @property {string} [codeTextColor] - Code text color
 * @property {string} [borderColor] - Border color
 * @property {string} [buttonIconColor] - Button icon color
 * @property {string} [scrollbarColor] - Scrollbar color
 * @property {string} [inputTextColor] - Input text color
 * @property {number} [inputAreaOpacity] - Input area opacity (0.0–1.0)
 * @property {boolean} [startOpen] - Auto-open chat on load
 * @property {number} [buttonSize] - Chat button size in pixels
 * @property {number} [windowWidth] - Chat window width in pixels
 * @property {number} [windowHeight] - Chat window height in pixels
 * @property {boolean} [showModelInfo] - Display model name in UI
 * @property {number} [maxHistoryTokens] - Token budget for conversation history
 * @property {number} [alwaysKeepRecentMessages] - Recent messages to keep uncompressed
 * @property {number} [maxHistoryMessages] - Maximum stored messages
 * @property {boolean} [debug] - Enable debug logging
 */

/**
 * @typedef {Object} ChatMessage
 * @property {"user"|"assistant"|"system"} role - Message sender role
 * @property {string} content - Message content
 */

/**
 * @typedef {Object} SourceData
 * @property {Object} source - Source information
 * @property {string} source.name - Source document name
 * @property {string} [source.description] - Source description
 * @property {Object<string, string>|string[]} [document] - Document content by citation number
 * @property {Object<string, Object>} [metadata] - Metadata by citation number
 */

/**
 * Timing constants for animations and delays (in milliseconds)
 */
const TIMINGS = {
  FOCUS_DELAY: 100, // Delay before focusing input
  DEBOUNCE_INPUT: 100, // Input debounce for auto-resize
  IOS_KEYBOARD_DELAY: 300, // Delay for iOS keyboard animations
  START_OPEN_DELAY: 1000, // Delay before auto-opening chat
  HIGHLIGHT_DURATION: 2000, // Duration for citation highlight
  COPY_SUCCESS_DURATION: 2000, // Duration for "copied" indicator
  PREVIEW_TIMEOUT: 5000, // Message preview display time
  PULSE_ANIMATION: 1500, // Pulse animation duration
};

/**
 * Size constants for UI elements (in pixels)
 */
const SIZES = {
  BUTTON_SIZE: 60, // Default chat button size (px)
  WINDOW_WIDTH: 450, // Default window width (px)
  WINDOW_HEIGHT: 600, // Default window height (px)
  MOBILE_BREAKPOINT: 768, // Mobile/desktop breakpoint (px)
  MOBILE_PADDING_BOTTOM: 180, // Mobile keyboard padding (px)
  SCROLLBAR_WIDTH: 6, // Scrollbar width (px)
  INPUT_MAX_HEIGHT: 100, // Max input field height (px)
};

/**
 * Limit constants for messages, history, and content lengths
 */
const LIMITS = {
  MAX_MESSAGE_LENGTH: 2000, // Max characters per message
  MAX_HISTORY_MESSAGES: 100, // Hard limit on stored messages
  MAX_HISTORY_TOKENS: 4000, // Token budget for API context
  ALWAYS_KEEP_RECENT: 10, // Recent messages never compressed
  SOURCE_NAME_LENGTH: 500, // Max source name length
  SOURCE_DESC_LENGTH: 1000, // Max source description length
  SNIPPET_LENGTH: 200, // Citation snippet length
  COMPRESSED_MSG_LENGTH: 200, // Compressed message length
  USER_MSG_LENGTH: 500, // Compressed user message length
  MAX_HEADINGS_LENGTH: 100, // Max heading string length
  MIN_CITATION_LENGTH: 15, // Min citation text length
  MODEL_NAME_LENGTH: 50, // Max model name length
  CHARS_PER_TOKEN: 4, // Approximate chars per token
};

// ============================================================================
// UTILITY CLASSES
// ============================================================================

/**
 * Simple event bus for decoupling components
 */
class EventBus {
  constructor() {
    this._events = {};
  }

  on(event, handler) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(handler);
  }

  emit(event, data) {
    if (!this._events[event]) return;
    this._events[event].forEach((handler) => handler(data));
  }

  off(event, handler) {
    if (!this._events[event]) return;
    this._events[event] = this._events[event].filter((h) => h !== handler);
  }
}

/**
 * Input validation and sanitization utilities
 */
class ChatValidators {
  /**
   * Validates API endpoint URL for security
   */
  static validateApiEndpoint(endpoint) {
    if (!endpoint) return null;
    try {
      const url = new URL(endpoint);
      if (!["https:", "http:"].includes(url.protocol)) {
        console.warn("Chat Widget: API endpoint - Protocol not allowed");
        return null;
      }
      return endpoint;
    } catch (e) {
      console.warn("Chat Widget: API endpoint - Invalid URL format");
      return null;
    }
  }

  /**
   * Validates and sanitizes AI model name
   */
  static validateModel(model) {
    if (!model || typeof model !== "string") {
      console.warn("Chat Widget: Model name - Expected string");
      return null;
    }
    if (!/^[a-zA-Z0-9\-_.]+$/.test(model)) {
      console.warn("Chat Widget: Model name - Pattern validation failed");
      return null;
    }
    return model.substring(0, LIMITS.MODEL_NAME_LENGTH);
  }

  /**
   * Validates and sanitizes citation source data
   */
  static validateSources(sources) {
    if (!Array.isArray(sources)) return [];

    return sources
      .filter((sourceData) => {
        if (!sourceData || typeof sourceData !== "object") return false;

        if (sourceData.source && typeof sourceData.source === "object") {
          if (
            sourceData.source.name &&
            typeof sourceData.source.name !== "string"
          )
            return false;
          if (
            sourceData.source.description &&
            typeof sourceData.source.description !== "string"
          )
            return false;
        }

        if (sourceData.document && typeof sourceData.document !== "object")
          return false;
        if (sourceData.metadata && typeof sourceData.metadata !== "object")
          return false;

        return true;
      })
      .map((sourceData) => {
        const sanitized = {};

        if (sourceData.source && typeof sourceData.source === "object") {
          sanitized.source = {
            name: String(sourceData.source.name || "").substring(
              0,
              LIMITS.SOURCE_NAME_LENGTH,
            ),
            description: sourceData.source.description
              ? String(sourceData.source.description).substring(
                  0,
                  LIMITS.SOURCE_DESC_LENGTH,
                )
              : "",
          };
        }

        if (sourceData.document) {
          sanitized.document = sourceData.document;
        }

        if (sourceData.metadata) {
          sanitized.metadata = sourceData.metadata;
        }

        return sanitized;
      });
  }

  /**
   * Escapes HTML special characters
   */
  static escapeHtml(unsafe) {
    if (typeof unsafe !== "string") return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

/**
 * Color utility functions
 */
class ColorUtils {
  /**
   * Converts hex color to rgba format with opacity
   */
  static hexToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  /**
   * Creates color-mix CSS value with opacity
   */
  static getColorWithOpacity(color, opacity) {
    const transparentPercent = (1 - opacity) * 100;
    return `color-mix(in srgb, ${color}, transparent ${transparentPercent}%)`;
  }
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Centralized state management with persistence
 */
class ChatState {
  constructor(options = {}) {
    this._state = {
      isOpen: false,
      history: [],
      unreadCount: 0,
      hasInteracted: false,
      traceId: null,
      lastFailedMessage: null,
    };
    this._listeners = new Set();
    this._options = options;
  }

  get(key) {
    return this._state[key];
  }

  getAll() {
    return { ...this._state };
  }

  update(updates) {
    const oldState = { ...this._state };
    this._state = { ...this._state, ...updates };
    this._notifyListeners(oldState, this._state);
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notifyListeners(oldState, newState) {
    this._listeners.forEach((listener) => listener(newState, oldState));
  }

  /**
   * Saves state to sessionStorage
   */
  save() {
    const stateToSave = {
      history: this._state.history,
      hasInteracted: this._state.hasInteracted,
      traceId: this._state.traceId,
    };

    if (this._options.debug) {
      console.log("Client saving state with traceId:", this._state.traceId);
    }

    sessionStorage.setItem("universalChatState", JSON.stringify(stateToSave));
  }

  /**
   * Restores state from sessionStorage
   */
  restore() {
    const saved = sessionStorage.getItem("universalChatState");
    if (saved) {
      const state = JSON.parse(saved);
      this.update({
        history: state.history || [],
        hasInteracted: state.hasInteracted || false,
        traceId: state.traceId || null,
      });

      if (this._options.debug) {
        console.log(
          "Client restored traceId from sessionStorage:",
          this._state.traceId,
        );
      }

      return true;
    }
    return false;
  }

  /**
   * Optimizes conversation history for API requests using token-aware sliding window
   */
  optimizeHistory() {
    const history = this._state.history;
    if (history.length === 0) return [];

    const recentCount = Math.min(
      this._options.alwaysKeepRecentMessages || LIMITS.ALWAYS_KEEP_RECENT,
      history.length,
    );
    const recentMessages = history.slice(-recentCount);
    const olderMessages = history.slice(0, -recentCount);

    let tokenCount = recentMessages.reduce(
      (sum, msg) => sum + this._estimateTokens(msg.content),
      0,
    );

    const maxTokens =
      this._options.maxHistoryTokens || LIMITS.MAX_HISTORY_TOKENS;

    if (tokenCount < maxTokens && olderMessages.length === 0) {
      return history;
    }

    const optimized = [...recentMessages];

    for (let i = olderMessages.length - 1; i >= 0; i--) {
      const compressed = this._compressMessage(olderMessages[i]);
      const compressedTokens = this._estimateTokens(compressed.content);

      if (tokenCount + compressedTokens <= maxTokens) {
        optimized.unshift(compressed);
        tokenCount += compressedTokens;
      } else {
        break;
      }
    }

    if (this._options.debug) {
      console.log(
        `History optimized: ${history.length} → ${optimized.length} messages (~${tokenCount} tokens)`,
      );
    }

    return optimized;
  }

  /**
   * Trims history to maximum message count
   */
  trimHistory() {
    const maxMessages =
      this._options.maxHistoryMessages || LIMITS.MAX_HISTORY_MESSAGES;
    if (this._state.history.length > maxMessages) {
      const removed = this._state.history.length - maxMessages;
      this.update({
        history: this._state.history.slice(-maxMessages),
      });

      if (this._options.debug) {
        console.log(`History trimmed: removed ${removed} oldest messages`);
      }
    }
  }

  /**
   * Estimates token count for text
   */
  _estimateTokens(text) {
    if (!text || typeof text !== "string") return 0;
    return Math.ceil(text.length / LIMITS.CHARS_PER_TOKEN);
  }

  /**
   * Compresses a message for history
   */
  _compressMessage(message) {
    if (message.role === "user") {
      return {
        role: "user",
        content: message.content.substring(0, LIMITS.USER_MSG_LENGTH),
      };
    } else {
      const content = message.content
        .replace(/```[\s\S]*?```/g, "[code]")
        .replace(/\[(\d+)\]/g, "")
        .replace(/[#*_]/g, "")
        .trim();

      const firstSentence = content.match(/^[^.!?]+[.!?]/);
      const compressed = firstSentence
        ? firstSentence[0]
        : content.substring(0, LIMITS.COMPRESSED_MSG_LENGTH);

      return {
        role: "assistant",
        content: compressed + (compressed.length < content.length ? "..." : ""),
      };
    }
  }
}

// ============================================================================
// API LAYER
// ============================================================================

/**
 * Handles all network communication with API
 */
class ChatAPI {
  constructor(endpoint, model, options = {}) {
    this.endpoint = endpoint;
    this.model = model;
    this.debug = options.debug || false;
  }

  /**
   * Sends message to API and returns response
   */
  async sendMessage(message, history, traceId) {
    if (this.debug) {
      console.log("Client sending traceId:", traceId);
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history,
        model: this.model,
        traceId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw this._createError(data.error || "Request failed", response);
    }

    return this._extractResponseData(data);
  }

  /**
   * Extracts content and sources from API response
   */
  _extractResponseData(data) {
    const content = data.choices?.[0]?.message?.content || data.response;

    // Extract sources from various possible paths
    let sources = [];
    if (data.source?.sources) {
      sources = Object.values(data.source.sources);
    } else if (data.sources) {
      sources = Array.isArray(data.sources)
        ? data.sources
        : Object.values(data.sources);
    } else if (data.context?.sources) {
      sources = Object.values(data.context.sources);
    } else if (data.choices?.[0]?.message?.sources) {
      sources = Object.values(data.choices[0].message.sources);
    }

    if (this.debug) {
      console.log("API Response:", data);
      console.log("Sources found:", sources);
      console.log("Content:", content);

      const citationMatches = content.match(/\[(\d+)\]/g);
      console.log("Citation numbers found in content:", citationMatches);
    }

    return {
      content,
      sources: ChatValidators.validateSources(sources),
      traceId: data.traceId,
      model: data.model,
    };
  }

  /**
   * Creates error with type detection
   */
  _createError(message, response) {
    const error = new Error(message);
    error.response = response;
    error.errorInfo = this._detectErrorType(error, response);
    return error;
  }

  /**
   * Detects and categorizes error type
   */
  _detectErrorType(error, response) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return {
        type: "network",
        message: "🔌 Connection lost. Check your internet and try again.",
      };
    }

    if (error.name === "AbortError") {
      return {
        type: "timeout",
        message: "Request timed out. The server took too long to respond.",
      };
    }

    if (response) {
      if (response.status === 429) {
        return {
          type: "ratelimit",
          message: "Too many requests. Please wait a moment and try again.",
        };
      }
      if (response.status >= 500) {
        return {
          type: "server",
          message: "Server error. The service is temporarily unavailable.",
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          type: "auth",
          message: "Authentication error. Please check your API configuration.",
        };
      }
      if (response.status >= 400) {
        return {
          type: "client",
          message: "❌ Invalid request. Please try again.",
        };
      }
    }

    return {
      type: "unknown",
      message: "Something went wrong. Please try again.",
    };
  }
}

// ============================================================================
// MESSAGE RENDERING
// ============================================================================

/**
 * Handles message formatting, LaTeX, citations, and code blocks
 */
class MessageRenderer {
  constructor(options) {
    this.options = options;
    this._katexLoaded = null;
  }

  /**
   * Formats message from markdown to HTML
   */
  formatMessage(content) {
    const escaped = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return escaped
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>")
      .replace(/(<\/h[1-6]>)<br>/g, "$1")
      .replace(/(<\/pre>)<br>/g, "$1");
  }

  /**
   * Renders LaTeX mathematical expressions
   */
  async renderLatex(messageElement) {
    await this._loadKaTeX();

    if (window.renderMathInElement) {
      window.renderMathInElement(messageElement, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
        errorColor: this.options.stampColor,
      });
    }
  }

  /**
   * Renders citations with clickable links
   */
  renderCitations(messageElement, sources = []) {
    const messageBubble = messageElement.querySelector(".message-bubble");
    if (!messageBubble) return;

    let content = messageBubble.innerHTML;
    const citations = {};

    const citationMatches = content.match(/\[(\d+)\]/g);
    const citationNumbers = citationMatches
      ? citationMatches.map((match) => parseInt(match.slice(1, -1)))
      : [];

    if (sources && sources.length > 0 && citationNumbers.length > 0) {
      this._extractCitationsFromSources(sources, citationNumbers, citations);
    } else if (citationNumbers.length === 0 && sources && sources.length > 0) {
      // Fallback: Parse citations from text content
      const citationPattern = /\[(\d+)\]\s*([\s\S]*?)(?=\s*\[\d+\]|$)/g;
      let match;

      while ((match = citationPattern.exec(content)) !== null) {
        const citationNum = parseInt(match[1]);
        const referenceText = match[2].trim();

        const cleanText = referenceText
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        if (cleanText.length > LIMITS.MIN_CITATION_LENGTH) {
          citations[citationNum] = referenceText;

          const replacement = `<span class="citation-link" data-citation="${citationNum}" title="Click to see reference" role="button" tabindex="0" aria-label="View reference ${citationNum}">[${citationNum}]</span>`;
          content = content.replace(match[0], replacement);
          citationPattern.lastIndex = 0;
        }
      }
    }

    // Replace citation numbers with clickable links
    content = content.replace(/\[(\d+)\]/g, (match, num) => {
      const citationNum = parseInt(num);
      if (citations[citationNum]) {
        return `<span class="citation-link" data-citation="${citationNum}" title="Click to see reference" role="button" tabindex="0" aria-label="View reference ${citationNum}">[${citationNum}]</span>`;
      }
      return match;
    });

    if (Object.keys(citations).length > 0) {
      content += this._buildReferencesSection(citations);
      messageBubble.innerHTML = content;
      this._attachCitationHandlers(messageElement);
    }
  }

  /**
   * Adds copy buttons to code blocks
   */
  addCopyButtonsToCodeBlocks(messageElement) {
    const codeBlocks = messageElement.querySelectorAll("pre");
    codeBlocks.forEach((codeBlock) => {
      const copyBtn = document.createElement("button");
      copyBtn.className = "code-copy-btn";
      copyBtn.textContent = "⧉";
      copyBtn.setAttribute("aria-label", "Copy code");

      copyBtn.addEventListener("click", async () => {
        const codeContent = codeBlock.querySelector("code") || codeBlock;
        const textToCopy = codeContent.textContent;

        try {
          await navigator.clipboard.writeText(textToCopy);
          this._showCopySuccess(copyBtn);
        } catch (err) {
          this._fallbackCopy(textToCopy, copyBtn);
        }
      });

      codeBlock.appendChild(copyBtn);
    });
  }

  /**
   * Loads KaTeX library
   */
  _loadKaTeX() {
    if (this._katexLoaded) return this._katexLoaded;

    this._katexLoaded = new Promise((resolve) => {
      if (window.katex) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
      script.onload = () => {
        const autoRenderScript = document.createElement("script");
        autoRenderScript.src =
          "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js";
        autoRenderScript.onload = () => resolve();
        document.head.appendChild(autoRenderScript);
      };
      document.head.appendChild(script);
    });

    return this._katexLoaded;
  }

  /**
   * Extracts citations from source data
   */
  _extractCitationsFromSources(sources, citationNumbers, citations) {
    sources.forEach((sourceData) => {
      const source = sourceData.source;
      const document = sourceData.document;
      const metadata = sourceData.metadata;

      if (document) {
        citationNumbers.forEach((citationNum) => {
          const docKey = citationNum.toString();
          const docContent = document[docKey] || document[citationNum - 1];

          if (docContent && typeof docContent === "string") {
            let referenceText = `<strong>${ChatValidators.escapeHtml(source.name)}</strong>`;
            if (source.description) {
              referenceText += ` - ${ChatValidators.escapeHtml(source.description)}`;
            }

            // Add metadata if available
            if (metadata && metadata[docKey]) {
              referenceText += this._formatMetadata(metadata[docKey]);
            }

            // Add snippet
            const snippet = String(docContent)
              .substring(0, LIMITS.SNIPPET_LENGTH)
              .replace(/[#*-]/g, "")
              .replace(/\s+/g, " ")
              .trim();

            if (snippet) {
              referenceText += `<br><em>${ChatValidators.escapeHtml(snippet)}...</em>`;
            }

            citations[citationNum] = referenceText;
          }
        });
      }
    });
  }

  /**
   * Formats metadata for display
   */
  _formatMetadata(metaInfo) {
    let result = "";

    if (metaInfo.headings && metaInfo.headings !== "[]") {
      try {
        let headings = [];

        if (
          typeof metaInfo.headings === "string" &&
          metaInfo.headings.startsWith("[") &&
          metaInfo.headings.endsWith("]")
        ) {
          const matches = metaInfo.headings.match(/'([^']*)'/g);
          if (matches) {
            headings = matches.map((match) => match.slice(1, -1));
          }
        }

        if (headings.length > 0) {
          const escapedHeadings = headings
            .map((h) => ChatValidators.escapeHtml(h))
            .join(" &gt; ");
          result += `<br><strong>Section:</strong> ${escapedHeadings}`;
        }
      } catch (parseError) {
        if (
          typeof metaInfo.headings === "string" &&
          metaInfo.headings.length < LIMITS.MAX_HEADINGS_LENGTH
        ) {
          result += `<br><strong>Section:</strong> ${ChatValidators.escapeHtml(metaInfo.headings)}`;
        }
      }
    }

    return result;
  }

  /**
   * Builds references section HTML
   */
  _buildReferencesSection(citations) {
    let referencesHtml =
      '<div class="references-section"><h4>References:</h4><ol class="references-list">';

    const sortedNums = Object.keys(citations).sort(
      (a, b) => parseInt(a) - parseInt(b),
    );
    sortedNums.forEach((num) => {
      referencesHtml += `<li id="ref-${num}" class="reference-item">${citations[num]}</li>`;
    });

    referencesHtml += "</ol></div>";
    return referencesHtml;
  }

  /**
   * Attaches click/keyboard handlers to citation links
   */
  _attachCitationHandlers(messageElement) {
    messageElement.querySelectorAll(".citation-link").forEach((link) => {
      const scrollToReference = (citationNum) => {
        const referenceElement = messageElement.querySelector(
          `#ref-${citationNum}`,
        );
        if (referenceElement) {
          referenceElement.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
          referenceElement.classList.add("highlighted");
          setTimeout(() => {
            referenceElement.classList.remove("highlighted");
          }, TIMINGS.HIGHLIGHT_DURATION);
        }
      };

      link.addEventListener("click", (e) => {
        scrollToReference(e.target.dataset.citation);
      });

      link.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          scrollToReference(e.target.dataset.citation);
        }
      });
    });
  }

  /**
   * Shows copy success indicator
   */
  _showCopySuccess(btn) {
    btn.textContent = "✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "⧉";
      btn.classList.remove("copied");
    }, TIMINGS.COPY_SUCCESS_DURATION);
  }

  /**
   * Fallback copy method for older browsers
   */
  _fallbackCopy(text, btn) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    this._showCopySuccess(btn);
  }
}

// ============================================================================
// STYLE GENERATION
// ============================================================================

/**
 * Generates CSS styles for the chat widget
 */
class StyleGenerator {
  constructor(options) {
    this.options = options;
  }

  generate() {
    return `
      ${this.generateVariables()}
      ${this.generateImports()}
      ${this.generateButton()}
      ${this.generateWindow()}
      ${this.generateMessages()}
      ${this.generateInput()}
      ${this.generateMarkdown()}
      ${this.generateCitations()}
      ${this.generateMobile()}
      ${this.generateAnimations()}
      ${this.generateAccessibility()}
    `;
  }

  generateVariables() {
    return `
      :root {
        /* Color variables */
        --chat-title-bg: ${this.options.titleBackgroundColor};
        --chat-title-fg: ${this.options.titleFontColor};
        --chat-assistant-color: ${this.options.assistantColor};
        --chat-assistant-fg: ${this.options.assistantFontColor};
        --chat-user-color: ${this.options.userColor};
        --chat-user-fg: ${this.options.userFontColor};
        --chat-background: ${this.options.chatBackground};
        --chat-stamp-color: ${this.options.stampColor};
        --chat-code-bg: ${this.options.codeBackgroundColor};
        --chat-code-fg: ${this.options.codeTextColor};
        --chat-border: ${this.options.borderColor};
        --chat-button-icon: ${this.options.buttonIconColor};
        --chat-scrollbar: ${this.options.scrollbarColor};
        --chat-input-fg: ${this.options.inputTextColor};

        /* Opacity variables */
        --assistant-opacity: ${this.options.assistantMessageOpacity};
        --user-opacity: ${this.options.userMessageOpacity};
        --code-opacity: ${this.options.codeOpacity};
        --input-opacity: ${this.options.inputAreaOpacity};

        /* Size variables */
        --button-size: ${this.options.buttonSize}px;
        --window-width: ${this.options.windowWidth}px;
        --window-height: ${this.options.windowHeight}px;
        --scrollbar-width: ${SIZES.SCROLLBAR_WIDTH}px;
        --input-max-height: ${SIZES.INPUT_MAX_HEIGHT}px;
      }
    `;
  }

  generateImports() {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500&display=swap');
      @import url('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css');
    `;
  }

  generateButton() {
    const position = this.options.position;
    return `
      .universal-chat-button {
        position: fixed;
        ${position.includes("right") ? "right: 20px" : "left: 20px"};
        ${position.includes("bottom") ? "bottom: 20px" : "top: 20px"};
        width: var(--button-size);
        height: var(--button-size);
        border-radius: 2px;
        background: var(--chat-assistant-color);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        z-index: 9998;
        border: none;
        color: var(--chat-button-icon);
        font-size: 28px;
      }

      .universal-chat-button:hover,
      .universal-chat-button:focus {
        background: var(--chat-stamp-color);
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
      }

      .universal-chat-button.chat-open {
        transform: rotate(90deg);
        background: var(--chat-user-color);
      }

      .universal-chat-button.chat-open:hover,
      .universal-chat-button.chat-open:focus {
        background: var(--chat-stamp-color);
        transform: rotate(90deg) scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
      }

      .chat-unread-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: var(--chat-assistant-color);
        color: var(--chat-stamp-color);
        border-radius: 2px;
        padding: 2px 6px;
        font-size: 12px;
        font-weight: bold;
        min-width: 20px;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .button-typing-indicator {
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--chat-background);
        padding: 4px 8px;
        border-radius: 2px;
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
        background: var(--chat-assistant-fg);
        animation: typingDot 1.4s infinite;
      }

      .button-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
      .button-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

      .button-message-preview {
        position: absolute;
        bottom: -35px;
        ${position.includes("right") ? "right: 0" : "left: 0"};
        background: var(--chat-background);
        padding: 8px 12px;
        border-radius: 2px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        max-width: 250px;
        font-size: 14px;
        color: var(--chat-assistant-fg);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        animation: slideIn 0.3s ease;
      }
    `;
  }

  generateWindow() {
    const position = this.options.position;
    return `
      .universal-chat-window {
        position: fixed;
        ${position.includes("right") ? "right: 20px" : "left: 20px"};
        ${position.includes("bottom") ? "bottom: calc(var(--button-size) + 40px)" : "top: calc(var(--button-size) + 40px)"};
        width: var(--window-width);
        height: var(--window-height);
        max-height: calc(100vh - var(--button-size) - 60px);
        background: var(--chat-background);
        border-radius: 2px;
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

      .chat-header {
        background: var(--chat-title-bg);
        color: var(--chat-title-fg);
        padding: 0.5rem 1.25rem;
        border-radius: 2px 2px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .chat-header-info h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--chat-title-fg);
      }

      .chat-header-actions {
        display: flex;
        gap: 0.5rem;
      }

      .chat-header-btn {
        background: transparent;
        border: none;
        color: var(--chat-title-fg);
        width: 44px;
        height: 44px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s;
        font-size: 28px;
      }

      .chat-header-btn:hover,
      .chat-header-btn:focus {
        color: var(--chat-stamp-color) !important;
        transform: scale(1.1);
        opacity: 1 !important;
        outline: none !important;
      }

      .model-info {
        font-size: 0.7rem;
        color: var(--chat-stamp-color);
        text-align: center;
        padding: 0.25rem;
        background: ${ColorUtils.hexToRgba(this.options.codeBackgroundColor, this.options.codeOpacity)};
        margin: 0 1rem;
        border-radius: 2px;
      }
    `;
  }

  generateMessages() {
    return `
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        padding-bottom: var(--input-max-height);
        background: var(--chat-background);
        scroll-behavior: smooth;
      }

      .chat-messages::-webkit-scrollbar {
        width: var(--scrollbar-width);
      }

      .chat-messages::-webkit-scrollbar-thumb {
        background: var(--chat-scrollbar);
        border-radius: 2px;
      }

      .message {
        margin-bottom: 1rem;
        animation: messageSlide 0.3s ease;
      }

      .message.user { text-align: right; }

      .message-bubble {
        display: inline-block;
        max-width: 90%;
        padding: 0.75rem 1rem;
        border-radius: 2px;
        word-wrap: break-word;
      }

      .message-bubble h1,
      .message-bubble h2,
      .message-bubble h3 {
        margin: 1rem 0 0.5rem 0;
        font-weight: 600;
        color: var(--chat-assistant-fg);
      }

      .message-bubble h1 { font-size: 1.4em; }
      .message-bubble h2 { font-size: 1.25em; }
      .message-bubble h3 { font-size: 1.1em; }

      .message-bubble h1:first-child,
      .message-bubble h2:first-child,
      .message-bubble h3:first-child {
        margin-top: 0;
      }

      .message.user .message-bubble {
        background: ${ColorUtils.getColorWithOpacity("var(--chat-user-color)", this.options.userMessageOpacity)};
        border: 1px solid var(--chat-border);
        color: var(--chat-user-fg);
        border-radius: 2px;
        text-align: left;
      }

      .message.assistant .message-bubble {
        background: ${ColorUtils.getColorWithOpacity("var(--chat-assistant-color)", this.options.assistantMessageOpacity)};
        border: 1px solid var(--chat-border);
        border-radius: 2px;
        color: var(--chat-assistant-fg);
      }

      .message-time {
        font-size: 0.7rem;
        color: var(--chat-stamp-color);
        margin-top: 0.25rem;
      }

      .typing-indicator {
        display: inline-block;
        padding: 0.75rem 1rem;
        background: ${ColorUtils.getColorWithOpacity("var(--chat-assistant-color)", this.options.assistantMessageOpacity)};
        border: 1px solid var(--chat-border);
        border-radius: 2px;
      }

      .typing-indicator span {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--chat-assistant-fg);
        margin: 0 2px;
        animation: typingBounce 1.4s infinite;
      }

      .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
      .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

      .message.error {
        text-align: center;
        margin: 1rem 0;
      }

      .message.error .message-bubble {
        background: ${ColorUtils.hexToRgba(this.options.stampColor, 0.1)};
        border: 1px solid var(--chat-stamp-color);
        color: var(--chat-assistant-fg);
        padding: 1rem;
        max-width: 100%;
      }

      .retry-btn {
        margin-top: 0.75rem;
        padding: 0.5rem 1rem;
        background: var(--chat-user-color);
        color: var(--chat-user-fg);
        border: 1px solid var(--chat-border);
        border-radius: 2px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .retry-btn:hover:not(:disabled),
      .retry-btn:focus:not(:disabled) {
        background: var(--chat-stamp-color);
        transform: scale(1.05);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        outline: none;
      }

      .retry-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }

  generateInput() {
    return `
      .chat-input-area {
        position: absolute;
        bottom: 1rem;
        left: 1rem;
        right: 1rem;
        background: ${ColorUtils.hexToRgba(this.options.chatBackground, this.options.inputAreaOpacity)};
        border-radius: 2px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10;
      }

      .chat-input-container {
        display: flex;
        border: 1px solid var(--chat-border);
        border-radius: 2px;
        overflow: hidden;
        background: transparent;
        padding: 0;
      }

      .chat-input {
        flex: 1;
        padding: 0.75rem;
        border: none;
        resize: none;
        font-family: inherit;
        font-size: 0.95rem;
        max-height: var(--input-max-height);
        background: transparent;
        color: var(--chat-input-fg);
      }

      .chat-input:focus {
        outline: none !important;
        caret-color: var(--chat-stamp-color);
      }

      .chat-input-container:focus-within {
        box-shadow: none !important;
      }

      .chat-send-btn {
        padding: 0.75rem 1rem;
        background: var(--chat-user-color);
        color: var(--chat-user-fg);
        border: none;
        border-left: 1px solid var(--chat-border);
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

      .chat-send-btn:hover:not(:disabled):not([aria-disabled="true"]),
      .chat-send-btn:focus:not(:disabled):not([aria-disabled="true"]) {
        background: var(--chat-stamp-color) !important;
        transform: scale(1.05);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        outline: none !important;
      }

      .chat-send-btn:disabled,
      .chat-send-btn[aria-disabled="true"] {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .chat-send-btn:disabled:hover,
      .chat-send-btn:disabled:focus,
      .chat-send-btn[aria-disabled="true"]:hover,
      .chat-send-btn[aria-disabled="true"]:focus {
        transform: none !important;
        box-shadow: none !important;
        background: var(--chat-user-color) !important;
      }
    `;
  }

  generateMarkdown() {
    return `
      .message-bubble code {
        background: ${ColorUtils.hexToRgba(this.options.codeBackgroundColor, this.options.codeOpacity)};
        padding: 0.125rem 0.25rem;
        border-radius: 2px;
        font-family: 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.9em;
        color: var(--chat-code-fg);
        word-break: break-all;
        white-space: pre-wrap;
      }

      .message.user .message-bubble code {
        background: ${ColorUtils.hexToRgba(this.options.codeBackgroundColor, this.options.codeOpacity)};
        color: var(--chat-code-fg);
      }

      .message-bubble pre {
        background: ${ColorUtils.hexToRgba(this.options.codeBackgroundColor, this.options.codeOpacity)};
        color: var(--chat-code-fg);
        padding: 0.5rem;
        margin-top: 0.1rem;
        border-radius: 2px;
        overflow-x: auto;
        overflow-y: hidden;
        max-width: 100%;
        white-space: pre-wrap;
        word-break: break-word;
        position: relative;
        font-family: 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        border: 1px solid var(--chat-border);
      }

      .message-bubble pre code {
        background: transparent;
        padding: 0;
        color: inherit;
        word-break: inherit;
        white-space: inherit;
      }

      .code-copy-btn {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        background: var(--chat-border);
        color: var(--chat-title-fg);
        border: none;
        border-radius: 4px;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s ease;
        z-index: 1;
      }

      .code-copy-btn:hover,
      .code-copy-btn:focus {
        background: var(--chat-stamp-color);
        transform: scale(1.05);
        outline: none;
      }

      .message-bubble pre:hover .code-copy-btn {
        opacity: 1;
      }

      .code-copy-btn.copied {
        background: var(--chat-assistant-color);
        color: var(--chat-assistant-fg);
      }

      .katex {
        font-size: 1.1em;
      }

      .katex-display {
        margin: 1em 0;
        text-align: center;
      }

      .katex-error {
        color: var(--chat-stamp-color);
        border: 1px solid var(--chat-stamp-color);
        padding: 0.25rem;
        border-radius: 3px;
        background: ${ColorUtils.hexToRgba(this.options.codeBackgroundColor, this.options.codeOpacity)};
      }
    `;
  }

  generateCitations() {
    return `
      .citation-link {
        color: var(--chat-code-fg);
        cursor: pointer;
        text-decoration: none;
        font-weight: 500;
        padding: 1px 3px;
        border-radius: 2px;
        transition: all 0.2s ease;
        font-size: 0.85em;
      }

      .citation-link:hover,
      .citation-link:focus {
        background: var(--chat-stamp-color);
        color: var(--chat-title-fg);
        transform: scale(1.05);
        outline: none;
      }

      .references-section {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--chat-border);
      }

      .references-section h4 {
        margin: 0 0 1rem 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--chat-assistant-fg);
      }

      .references-list {
        margin: 0;
        padding-left: 1rem;
        font-size: 0.75em;
      }

      .reference-item {
        margin-bottom: 0.5rem;
        color: var(--chat-assistant-fg);
        transition: background-color 0.3s ease;
        text-align: justify;
      }

      .reference-item.highlighted {
        background: ${ColorUtils.hexToRgba(this.options.codeBackgroundColor, this.options.codeOpacity)};
        padding: 0.5rem;
        border-radius: 2px;
        border-left: 2px solid var(--chat-user-color);
      }
    `;
  }

  generateMobile() {
    return `
      @media (max-width: ${SIZES.MOBILE_BREAKPOINT}px) {
        .universal-chat-window {
          width: 100vw !important;
          height: 100vh !important;
          height: 100dvh !important;
          max-height: 100vh !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        .universal-chat-window.open {
          transform: none !important;
        }

        .universal-chat-button.chat-open {
          display: none !important;
        }

        .chat-messages {
          padding-bottom: calc(120px + env(safe-area-inset-bottom, 0));
          -webkit-overflow-scrolling: touch;
        }

        .chat-input-area {
          position: fixed !important;
          bottom: env(safe-area-inset-bottom, 0);
          left: 1rem;
          right: 1rem;
          width: auto;
          max-width: none;
          margin: 0;
          border-radius: 2px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding-bottom: 0;
          z-index: 1000;
        }

        .chat-input-container {
          border-radius: 2px;
          border: 1px solid var(--chat-border);
        }

        .chat-input {
          font-size: 16px !important;
        }
      }

      @media (hover: none) and (pointer: coarse) {
        .universal-chat-button:active {
          background: var(--chat-stamp-color);
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        }

        .universal-chat-button.chat-open:active {
          background: var(--chat-stamp-color);
          transform: rotate(90deg) scale(1.1);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        }

        .chat-header-btn:active {
          color: var(--chat-stamp-color) !important;
          transform: scale(1.1);
          opacity: 1 !important;
        }

        .chat-send-btn:active:not(:disabled):not([aria-disabled="true"]) {
          background: var(--chat-stamp-color) !important;
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .code-copy-btn:active {
          background: var(--chat-stamp-color);
          transform: scale(1.05);
        }

        .message-bubble pre .code-copy-btn {
          opacity: 1;
        }

        .citation-link:active {
          background: var(--chat-stamp-color);
          color: var(--chat-title-fg);
          transform: scale(1.05);
        }

        .retry-btn:active:not(:disabled) {
          background: var(--chat-stamp-color);
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
      }
    `;
  }

  generateAnimations() {
    return `
      @keyframes messageSlide {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes typingDot {
        0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
        30% { opacity: 1; transform: scale(1.2); }
      }

      @keyframes typingBounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-10px); }
      }

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
  }

  generateAccessibility() {
    return `
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }

      .universal-chat-window ::selection {
        background: ${ColorUtils.hexToRgba(this.options.userColor, 0.3)};
        color: var(--chat-assistant-fg);
      }

      .universal-chat-window ::-moz-selection {
        background: ${ColorUtils.hexToRgba(this.options.userColor, 0.3)};
        color: var(--chat-assistant-fg);
      }
    `;
  }
}

// ============================================================================
// ACCESSIBILITY MANAGER
// ============================================================================

/**
 * Manages focus trap and keyboard navigation
 */
class AccessibilityManager {
  constructor(window, options = {}) {
    this.window = window;
    this.options = options;
    this.focusTrapHandler = null;
  }

  /**
   * Gets all focusable elements within chat window
   */
  getFocusableElements() {
    if (!this.window) return [];

    const focusableSelectors = [
      "button:not([disabled]):not([tabindex='-1'])",
      "a[href]:not([tabindex='-1'])",
      "input:not([disabled]):not([tabindex='-1'])",
      "textarea:not([disabled]):not([tabindex='-1'])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    const elements = Array.from(
      this.window.querySelectorAll(focusableSelectors),
    );

    if (this.options.debug) {
      console.log("Focusable elements found:", elements.length);
      elements.forEach((el, i) => {
        console.log(`  ${i}: ${el.tagName}.${el.className}`);
      });
    }

    return elements;
  }

  /**
   * Traps focus within chat window
   */
  trapFocus(e) {
    if (e.key !== "Tab") return;

    e.preventDefault();

    const focusableElements = this.getFocusableElements();
    if (focusableElements.length === 0) return;

    const activeElement = document.activeElement;
    const currentIndex = focusableElements.indexOf(activeElement);

    if (this.options.debug) {
      console.log(
        `Tab pressed! Shift: ${e.shiftKey}, Current: ${activeElement.className}, Index: ${currentIndex}`,
      );
    }

    if (currentIndex === -1) {
      if (e.shiftKey) {
        focusableElements[focusableElements.length - 1].focus();
      } else {
        focusableElements[0].focus();
      }
      return;
    }

    let nextIndex;
    if (e.shiftKey) {
      nextIndex =
        currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
    } else {
      nextIndex =
        currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1;
    }

    if (this.options.debug) {
      console.log(`Moving from ${currentIndex} to ${nextIndex}`);
    }

    focusableElements[nextIndex].focus();
  }

  /**
   * Sets up focus trap
   */
  setup() {
    this.focusTrapHandler = (e) => this.trapFocus(e);
    document.addEventListener("keydown", this.focusTrapHandler);
  }

  /**
   * Removes focus trap
   */
  remove() {
    if (this.focusTrapHandler) {
      document.removeEventListener("keydown", this.focusTrapHandler);
      this.focusTrapHandler = null;
    }
  }
}

// ============================================================================
// UI LAYER
// ============================================================================

/**
 * Handles all DOM manipulation and UI updates
 */
class ChatUI {
  constructor(options, eventBus) {
    this.options = options;
    this.eventBus = eventBus;
    this.elements = {};
    this.debounceTimers = {};
    this.rafIds = {};
    this.previewTimeout = null;
    this.accessibilityManager = null;
  }

  /**
   * Initializes UI
   */
  init() {
    this._ensureViewportMeta();
    this._injectStyles();
    this._createWidget();
    this._bindEvents();
    this.accessibilityManager = new AccessibilityManager(
      this.elements.window,
      this.options,
    );
  }

  /**
   * Opens chat window
   */
  open() {
    this.elements.window.classList.add("open");
    this.elements.button.classList.add("chat-open");
    this.elements.button.innerHTML = "×";
    this.elements.button.setAttribute(
      "aria-label",
      "Close chat. Press Escape or Enter to close",
    );
    this.elements.button.setAttribute("aria-expanded", "true");
    this.elements.button.setAttribute("tabindex", "-1");
    this.elements.button.title = "Close chat (Escape)";
    this.elements.window.setAttribute("aria-modal", "true");

    this.hideMessagePreview();
    this.hideButtonTyping();

    setTimeout(() => {
      this.elements.input.focus();
    }, TIMINGS.FOCUS_DELAY);

    this.accessibilityManager.setup();
  }

  /**
   * Closes chat window
   */
  close() {
    this.elements.window.classList.remove("open");
    this.elements.button.classList.remove("chat-open");
    this.elements.button.innerHTML = "💬";
    this.elements.button.setAttribute(
      "aria-label",
      "Open chat. Press Enter to open, Escape to close",
    );
    this.elements.button.setAttribute("aria-expanded", "false");
    this.elements.button.setAttribute("tabindex", "0");
    this.elements.button.title = "Open chat (Enter)";
    this.elements.window.setAttribute("aria-modal", "false");

    this.accessibilityManager.remove();
    this.elements.button.focus();
  }

  /**
   * Adds message to chat
   */
  addMessage(type, content, time) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${type}`;
    messageEl.setAttribute("role", "article");
    const sender = type === "user" ? "You" : "Assistant";
    messageEl.setAttribute("aria-label", `Message from ${sender} at ${time}`);
    messageEl.innerHTML = `
      <div class="message-bubble">${content}</div>
      <div class="message-time" aria-label="sent at ${time}">${time}</div>
    `;
    this.elements.messages.appendChild(messageEl);
    this._scrollToBottom();
    return messageEl;
  }

  /**
   * Shows typing indicator
   */
  showTyping() {
    const typingEl = document.createElement("div");
    typingEl.className = "message assistant";
    typingEl.id = "typing-indicator";
    typingEl.setAttribute("role", "status");
    typingEl.setAttribute("aria-live", "polite");
    typingEl.setAttribute("aria-label", "Assistant is typing");
    typingEl.innerHTML =
      '<div class="typing-indicator" aria-hidden="true"><span></span><span></span><span></span></div>';
    this.elements.messages.appendChild(typingEl);
    this._scrollToBottom();
  }

  /**
   * Hides typing indicator
   */
  hideTyping() {
    const typingEl = document.getElementById("typing-indicator");
    if (typingEl) typingEl.remove();
  }

  /**
   * Shows typing indicator on button
   */
  showButtonTyping() {
    this.elements.buttonTypingIndicator.style.display = "flex";
  }

  /**
   * Hides typing indicator on button
   */
  hideButtonTyping() {
    this.elements.buttonTypingIndicator.style.display = "none";
  }

  /**
   * Shows message preview
   */
  showMessagePreview(message) {
    if (message) {
      this.hideMessagePreview();
      const preview = document.createElement("div");
      preview.className = "button-message-preview";
      preview.id = "message-preview";
      const truncated =
        message.length > 60 ? message.substring(0, 60) + "..." : message;
      preview.textContent = truncated;
      this.elements.button.appendChild(preview);
      this.previewTimeout = setTimeout(
        () => this.hideMessagePreview(),
        TIMINGS.PREVIEW_TIMEOUT,
      );
    }
  }

  /**
   * Hides message preview
   */
  hideMessagePreview() {
    const preview = document.getElementById("message-preview");
    if (preview) preview.remove();
    if (this.previewTimeout) clearTimeout(this.previewTimeout);
  }

  /**
   * Shows error message
   */
  showError(message) {
    const errorEl = document.createElement("div");
    errorEl.className = "message error";
    errorEl.setAttribute("role", "alert");
    errorEl.innerHTML = `
      <div class="message-bubble">
        ${message}
        <br>
        <button class="retry-btn" aria-label="Retry sending message">↻ Retry</button>
      </div>
    `;
    this.elements.messages.appendChild(errorEl);
    this._scrollToBottom();

    const retryBtn = errorEl.querySelector(".retry-btn");
    retryBtn.addEventListener("click", async () => {
      retryBtn.disabled = true;
      retryBtn.textContent = "Retrying...";
      this.eventBus.emit("retry");
      errorEl.remove();
    });
  }

  /**
   * Clears all messages
   */
  clearMessages() {
    this.elements.messages.innerHTML = "";
  }

  /**
   * Updates unread badge
   */
  updateUnreadBadge(count) {
    if (count > 0) {
      this.elements.unreadBadge.textContent = count;
      this.elements.unreadBadge.style.display = "block";
    } else {
      this.elements.unreadBadge.style.display = "none";
    }
  }

  /**
   * Clears input field
   */
  clearInput() {
    this.elements.input.value = "";
    this._autoResizeInput();
    this.elements.sendBtn.setAttribute("aria-disabled", "true");
    this.elements.sendBtn.setAttribute("tabindex", "-1");
  }

  /**
   * Gets input value
   */
  getInputValue() {
    return this.elements.input.value.trim();
  }

  /**
   * Makes button pulse
   */
  pulseButton() {
    this.elements.button.style.animation = "pulse 0.5s ease 3";
    setTimeout(() => {
      this.elements.button.style.animation = "";
    }, TIMINGS.PULSE_ANIMATION);
  }

  /**
   * Scrolls to bottom
   */
  _scrollToBottom() {
    this._scheduleScroll(() => {
      this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    });
  }

  /**
   * Schedules scroll with RAF
   */
  _scheduleScroll(callback) {
    if (this.rafIds.scroll) {
      cancelAnimationFrame(this.rafIds.scroll);
    }
    this.rafIds.scroll = requestAnimationFrame(callback);
  }

  /**
   * Auto-resizes input
   */
  _autoResizeInput() {
    this.elements.input.style.height = "auto";
    this.elements.input.style.height =
      Math.min(this.elements.input.scrollHeight, SIZES.INPUT_MAX_HEIGHT) + "px";
  }

  /**
   * Binds event listeners
   */
  _bindEvents() {
    this.elements.button.addEventListener("click", () => {
      this.eventBus.emit("toggle");
    });

    this.elements.closeBtn.addEventListener("click", () => {
      this.eventBus.emit("close");
    });

    this.elements.clearBtn.addEventListener("click", () => {
      this.eventBus.emit("clear");
    });

    this.elements.sendBtn.addEventListener("click", () => {
      if (this.elements.sendBtn.getAttribute("aria-disabled") !== "true") {
        this.eventBus.emit("send", this.getInputValue());
      }
    });

    this.elements.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (this.elements.sendBtn.getAttribute("aria-disabled") !== "true") {
          this.eventBus.emit("send", this.getInputValue());
        }
      }
    });

    this.elements.input.addEventListener("input", () => {
      const hasText = this.elements.input.value.trim().length > 0;
      this.elements.sendBtn.setAttribute(
        "aria-disabled",
        hasText ? "false" : "true",
      );
      this.elements.sendBtn.setAttribute("tabindex", hasText ? "0" : "-1");
      this._debounce(
        "autoResize",
        () => this._autoResizeInput(),
        TIMINGS.DEBOUNCE_INPUT,
      );
    });

    // iOS keyboard handling
    this.elements.input.addEventListener("focus", () => {
      setTimeout(() => {
        this.elements.input.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        if (window.innerWidth <= SIZES.MOBILE_BREAKPOINT) {
          this.elements.messages.style.paddingBottom = `${SIZES.MOBILE_PADDING_BOTTOM}px`;
        }
      }, TIMINGS.IOS_KEYBOARD_DELAY);
    });

    this.elements.input.addEventListener("blur", () => {
      if (window.innerWidth <= SIZES.MOBILE_BREAKPOINT) {
        this.elements.messages.style.paddingBottom = "";
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.eventBus.emit("close");
      }
    });
  }

  /**
   * Debounces function calls
   */
  _debounce(key, callback, delay = 150) {
    if (this.debounceTimers[key]) {
      clearTimeout(this.debounceTimers[key]);
    }
    this.debounceTimers[key] = setTimeout(callback, delay);
  }

  /**
   * Ensures viewport meta tag exists
   */
  _ensureViewportMeta() {
    let viewportMeta = document.querySelector('meta[name="viewport"]');

    if (!viewportMeta) {
      viewportMeta = document.createElement("meta");
      viewportMeta.name = "viewport";
      viewportMeta.content =
        "width=device-width, initial-scale=1.0, viewport-fit=cover";
      document.head.appendChild(viewportMeta);
    } else if (!viewportMeta.content.includes("viewport-fit=cover")) {
      viewportMeta.content = viewportMeta.content + ", viewport-fit=cover";
    }
  }

  /**
   * Injects CSS styles
   */
  _injectStyles() {
    if (document.getElementById("universal-chat-styles")) return;

    const styleGenerator = new StyleGenerator(this.options);
    const styles = document.createElement("style");
    styles.id = "universal-chat-styles";
    styles.textContent = styleGenerator.generate();
    document.head.appendChild(styles);
  }

  /**
   * Creates widget DOM
   */
  _createWidget() {
    // Button
    this.elements.button = document.createElement("button");
    this.elements.button.className = "universal-chat-button";
    this.elements.button.innerHTML = "💬";
    this.elements.button.setAttribute(
      "aria-label",
      "Open chat. Press Enter to open, Escape to close",
    );
    this.elements.button.setAttribute("aria-expanded", "false");
    this.elements.button.setAttribute("aria-haspopup", "dialog");
    this.elements.button.setAttribute("tabindex", "0");
    this.elements.button.title = "Open chat (Enter)";

    // Unread badge
    this.elements.unreadBadge = document.createElement("span");
    this.elements.unreadBadge.className = "chat-unread-badge";
    this.elements.unreadBadge.style.display = "none";
    this.elements.unreadBadge.setAttribute("aria-label", "unread messages");
    this.elements.button.appendChild(this.elements.unreadBadge);

    // Typing indicator for button
    this.elements.buttonTypingIndicator = document.createElement("div");
    this.elements.buttonTypingIndicator.className = "button-typing-indicator";
    this.elements.buttonTypingIndicator.innerHTML =
      "<span></span><span></span><span></span>";
    this.elements.buttonTypingIndicator.style.display = "none";
    this.elements.buttonTypingIndicator.setAttribute("role", "status");
    this.elements.buttonTypingIndicator.setAttribute(
      "aria-label",
      "Assistant is typing",
    );
    this.elements.button.appendChild(this.elements.buttonTypingIndicator);

    // Window
    this.elements.window = document.createElement("div");
    this.elements.window.className = "universal-chat-window";
    this.elements.window.setAttribute("role", "dialog");
    this.elements.window.setAttribute("aria-label", this.options.title);
    this.elements.window.setAttribute("aria-modal", "false");
    this.elements.window.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-info">
          <h3 id="chat-title">${this.options.title}</h3>
        </div>
        <div class="chat-header-actions">
          <button class="chat-header-btn chat-clear-btn" title="Clear chat" aria-label="Clear chat history">↻</button>
          <button class="chat-header-btn chat-close-btn" title="Minimize" aria-label="Close chat">×</button>
        </div>
      </div>
      ${this.options.showModelInfo ? '<div class="model-info" id="model-info" role="status"></div>' : ""}
      <div class="chat-messages" role="log" aria-live="polite" aria-atomic="false" aria-label="Chat conversation"></div>
      <div class="chat-input-area">
        <div class="chat-input-container">
          <textarea
            class="chat-input"
            placeholder="${this.options.placeholder}"
            maxlength="${LIMITS.MAX_MESSAGE_LENGTH}"
            rows="1"
            aria-label="Type your message. Press Enter to send, Shift+Enter for new line"
            aria-describedby="char-limit keyboard-hints"></textarea>
          <button class="chat-send-btn" tabindex="-1" aria-disabled="true" aria-label="Send message (Enter)">Send</button>
        </div>
        <div id="char-limit" class="sr-only">Maximum ${LIMITS.MAX_MESSAGE_LENGTH} characters</div>
        <div id="keyboard-hints" class="sr-only">Keyboard shortcuts: Enter to send, Shift+Enter for new line, Escape to close chat</div>
      </div>
    `;

    document.body.appendChild(this.elements.button);
    document.body.appendChild(this.elements.window);

    this.elements.messages =
      this.elements.window.querySelector(".chat-messages");
    this.elements.input = this.elements.window.querySelector(".chat-input");
    this.elements.sendBtn =
      this.elements.window.querySelector(".chat-send-btn");
    this.elements.closeBtn =
      this.elements.window.querySelector(".chat-close-btn");
    this.elements.clearBtn =
      this.elements.window.querySelector(".chat-clear-btn");
    this.elements.modelInfo = this.elements.window.querySelector("#model-info");
  }

  /**
   * Destroys UI
   */
  destroy() {
    Object.values(this.debounceTimers).forEach((timer) => clearTimeout(timer));
    Object.values(this.rafIds).forEach((id) => cancelAnimationFrame(id));

    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
    }

    if (this.accessibilityManager) {
      this.accessibilityManager.remove();
    }

    if (this.elements.button) this.elements.button.remove();
    if (this.elements.window) this.elements.window.remove();

    const styleEl = document.getElementById("universal-chat-styles");
    if (styleEl) styleEl.remove();
  }
}

// ============================================================================
// MAIN WIDGET (ORCHESTRATOR)
// ============================================================================

/**
 * Universal Chat Widget - Main orchestrator class
 */
class UniversalChatWidget {
  constructor(options = {}) {
    // Normalize and validate options
    this.options = this._normalizeOptions(options);

    // Initialize core components
    this.eventBus = new EventBus();
    this.state = new ChatState(this.options);
    this.api = new ChatAPI(this.options.apiEndpoint, this.options.model, {
      debug: this.options.debug,
    });
    this.renderer = new MessageRenderer(this.options);
    this.ui = new ChatUI(this.options, this.eventBus);

    // Subscribe to events
    this._subscribeToEvents();

    // Initialize UI
    this.ui.init();

    // Restore state or show welcome
    if (this.state.restore()) {
      this._rebuildMessagesFromHistory();
    } else {
      this._showWelcomeMessage();
    }

    // Auto-open if configured
    if (this.options.startOpen && !this.state.get("hasInteracted")) {
      setTimeout(() => this._handleOpen(), TIMINGS.START_OPEN_DELAY);
    }
  }

  /**
   * Subscribe to all events
   */
  _subscribeToEvents() {
    this.eventBus.on("toggle", () => {
      this.state.get("isOpen") ? this._handleClose() : this._handleOpen();
    });

    this.eventBus.on("open", () => this._handleOpen());
    this.eventBus.on("close", () => this._handleClose());
    this.eventBus.on("clear", () => this._handleClear());
    this.eventBus.on("send", (message) => this._handleSend(message));
    this.eventBus.on("retry", () => this._handleRetry());

    // Subscribe to state changes
    this.state.subscribe((newState, oldState) => {
      if (newState.isOpen !== oldState.isOpen) {
        newState.isOpen ? this.ui.open() : this.ui.close();
      }

      if (newState.unreadCount !== oldState.unreadCount) {
        this.ui.updateUnreadBadge(newState.unreadCount);
      }

      // Save state on any change
      this.state.save();
    });
  }

  /**
   * Handles opening chat
   */
  _handleOpen() {
    this.state.update({
      isOpen: true,
      hasInteracted: true,
      unreadCount: 0,
    });
  }

  /**
   * Handles closing chat
   */
  _handleClose() {
    this.state.update({ isOpen: false });
  }

  /**
   * Handles clearing chat
   */
  _handleClear() {
    this.state.update({ history: [] });
    this.ui.clearMessages();
    this._showWelcomeMessage();
  }

  /**
   * Handles sending message
   */
  async _handleSend(message) {
    if (!message) return;

    // Add user message to state and UI
    const history = [
      ...this.state.get("history"),
      { role: "user", content: message },
    ];
    this.state.update({ history });

    const formatted = this.renderer.formatMessage(message);
    const messageEl = this.ui.addMessage(
      "user",
      formatted,
      this._formatTime(new Date()),
    );
    this.ui.clearInput();
    this.ui.showTyping();

    if (!this.state.get("isOpen")) {
      this.ui.showButtonTyping();
    }

    try {
      // Optimize history and send
      const optimizedHistory = this.state.optimizeHistory();
      const response = await this.api.sendMessage(
        message,
        optimizedHistory,
        this.state.get("traceId"),
      );

      // Update state with response
      this.state.update({
        history: [
          ...this.state.get("history"),
          { role: "assistant", content: response.content },
        ],
        traceId: response.traceId,
        lastFailedMessage: null,
      });

      // Trim if needed
      this.state.trimHistory();

      // Update model info if available
      if (this.ui.elements.modelInfo && response.model) {
        this.ui.elements.modelInfo.textContent = `Model: ${response.model}`;
      }

      // Render response
      this.ui.hideTyping();
      this.ui.hideButtonTyping();
      const formattedResponse = this.renderer.formatMessage(response.content);
      const assistantEl = this.ui.addMessage(
        "assistant",
        formattedResponse,
        this._formatTime(new Date()),
      );

      // Add enhancements
      this.renderer.addCopyButtonsToCodeBlocks(assistantEl);
      await this.renderer.renderLatex(assistantEl);
      this.renderer.renderCitations(assistantEl, response.sources);

      // Handle unread if closed
      if (!this.state.get("isOpen")) {
        this.state.update({
          unreadCount: this.state.get("unreadCount") + 1,
        });
        this.ui.showMessagePreview(response.content);
        this.ui.pulseButton();
      }
    } catch (error) {
      console.error("Chat error:", error);
      this.ui.hideTyping();
      this.ui.hideButtonTyping();
      this.state.update({ lastFailedMessage: message });

      const errorInfo = error.errorInfo || {
        message: "Something went wrong. Please try again.",
      };
      this.ui.showError(errorInfo.message);
    }
  }

  /**
   * Handles retry
   */
  async _handleRetry() {
    const message = this.state.get("lastFailedMessage");
    if (message) {
      await this._handleSend(message);
    }
  }

  /**
   * Shows welcome message
   */
  _showWelcomeMessage() {
    const formatted = this.renderer.formatMessage(this.options.welcomeMessage);
    const welcomeEl = this.ui.addMessage(
      "assistant",
      formatted,
      this._formatTime(new Date()),
    );
    this.renderer.addCopyButtonsToCodeBlocks(welcomeEl);
    this.renderer.renderLatex(welcomeEl);
    this.renderer.renderCitations(welcomeEl, []);
  }

  /**
   * Rebuilds messages from history
   */
  _rebuildMessagesFromHistory() {
    const history = this.state.get("history");
    if (history.length > 0) {
      this.ui.clearMessages();
      history.forEach((msg) => {
        if (msg.role !== "system") {
          const formatted = this.renderer.formatMessage(msg.content);
          const msgEl = this.ui.addMessage(
            msg.role === "user" ? "user" : "assistant",
            formatted,
            "",
          );
          this.renderer.addCopyButtonsToCodeBlocks(msgEl);
          this.renderer.renderLatex(msgEl);
          this.renderer.renderCitations(msgEl, []);
        }
      });
    }
  }

  /**
   * Normalizes options with defaults
   */
  _normalizeOptions(options) {
    return {
      title: options.title || "Course Assistant",
      welcomeMessage:
        options.welcomeMessage || "Hello! How can I help you today?",
      placeholder: options.placeholder || "Type your question...",
      position: options.position || "bottom-right",
      apiEndpoint:
        ChatValidators.validateApiEndpoint(options.apiEndpoint) ||
        "https://your-worker.workers.dev",
      model:
        ChatValidators.validateModel(options.model) || "mistral-medium-latest",
      titleBackgroundColor: options.titleBackgroundColor || "FDF8ED",
      titleFontColor: options.titleFontColor || "363D45",

      assistantColor: options.assistantColor || "FCCF9C",
      assistantFontColor: options.assistantFontColor || "363D45",
      assistantMessageOpacity: options.assistantMessageOpacity || 0.9,

      userColor: options.userColor || "#A7C7C6",
      userFontColor: options.userFontColor || "363D45",
      userMessageOpacity: options.userMessageOpacity || 0.9,

      chatBackground: options.chatBackground || "#ffffff",
      stampColor: options.stampColor || "DB6B6B",
      codeBackgroundColor: options.codeBackgroundColor || "FFEEE2",
      codeOpacity: options.codeOpacity || 0.9,
      codeTextColor: options.codeTextColor || "537E8F",

      borderColor: options.borderColor || "363D45",
      buttonIconColor: options.buttonIconColor || "363D45",
      scrollbarColor: options.scrollbarColor || "FDF8ED",
      inputTextColor: options.inputTextColor || "363D45",

      inputAreaOpacity: options.inputAreaOpacity || 0.95,
      startOpen: options.startOpen || false,
      buttonSize: options.buttonSize || SIZES.BUTTON_SIZE,
      windowWidth: options.windowWidth || SIZES.WINDOW_WIDTH,
      windowHeight: options.windowHeight || SIZES.WINDOW_HEIGHT,
      showModelInfo: options.showModelInfo || false,
      maxHistoryTokens: options.maxHistoryTokens || LIMITS.MAX_HISTORY_TOKENS,
      alwaysKeepRecentMessages:
        options.alwaysKeepRecentMessages || LIMITS.ALWAYS_KEEP_RECENT,
      maxHistoryMessages:
        options.maxHistoryMessages || LIMITS.MAX_HISTORY_MESSAGES,
      debug: options.debug || false,
      ...options,
    };
  }

  /**
   * Formats time
   */
  _formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  /**
   * Static constants for backward compatibility
   */
  static TIMINGS = TIMINGS;
  static SIZES = SIZES;
  static LIMITS = LIMITS;

  /**
   * Destroys widget
   */
  destroy() {
    this.ui.destroy();
    this.state = null;
    this.api = null;
    this.renderer = null;

    if (this.options.debug) {
      console.log("Chat widget destroyed and cleaned up");
    }
  }
}

// ============================================================================
// AUTO-INITIALIZATION & EXPORT
// ============================================================================

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
