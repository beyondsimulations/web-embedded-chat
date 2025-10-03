// Universal Chat Widget - Works with any OpenAI-compatible API

/**
 * @typedef {Object} ChatOptions
 * @property {string} [title="Course Assistant"] - Chat window title
 * @property {string} [welcomeMessage="Hello! How can I help you today?"] - Initial greeting message
 * @property {string} [placeholder="Type your question..."] - Input placeholder text
 * @property {string} [position="bottom-right"] - Widget position (bottom-right, bottom-left, top-right, top-left)
 * @property {string} apiEndpoint - API endpoint URL for chat requests
 * @property {string} [model="gpt-3.5-turbo"] - AI model name
 * @property {string} [titleBackgroundColor="#2c3532"] - Header background color
 * @property {string} [titleFontColor="#ffffff"] - Header text color
 * @property {string} [assistantColor="#fdcd9a"] - Assistant message bubble color
 * @property {string} [assistantFontColor="#2c3532"] - Assistant text color
 * @property {number} [assistantMessageOpacity=1.0] - Assistant bubble opacity (0.0-1.0)
 * @property {string} [userColor="#99bfbb"] - User message bubble color
 * @property {string} [userFontColor="#2c3532"] - User text color
 * @property {number} [userMessageOpacity=1.0] - User bubble opacity (0.0-1.0)
 * @property {string} [chatBackground="#ffffff"] - Chat window background color
 * @property {string} [stampColor="#df7d7d"] - Timestamp and badge color
 * @property {string} [codeBackgroundColor="#f3f4f6"] - Code block background color
 * @property {number} [codeOpacity=0.85] - Code block opacity (0.0-1.0)
 * @property {string} [codeTextColor="#2c3532"] - Code text color
 * @property {string} [borderColor="#2c3532"] - Border color
 * @property {string} [buttonIconColor="#ffffff"] - Button icon color
 * @property {string} [scrollbarColor="#d1d5db"] - Scrollbar color
 * @property {string} [inputTextColor="#1f2937"] - Input text color
 * @property {number} [inputAreaOpacity=0.95] - Input area opacity (0.0-1.0)
 * @property {boolean} [startOpen=false] - Auto-open chat on load
 * @property {number} [buttonSize=60] - Chat button size in pixels
 * @property {number} [windowWidth=450] - Chat window width in pixels
 * @property {number} [windowHeight=600] - Chat window height in pixels
 * @property {boolean} [showModelInfo=false] - Display model name in UI
 * @property {number} [maxHistoryTokens=4000] - Token budget for conversation history
 * @property {number} [alwaysKeepRecentMessages=10] - Recent messages to keep uncompressed
 * @property {number} [maxHistoryMessages=100] - Maximum stored messages
 * @property {boolean} [debug=false] - Enable debug logging
 */

/**
 * @typedef {Object} ChatMessage
 * @property {"user"|"assistant"|"system"} role - Message sender role
 * @property {string} content - Message content
 */

/**
 * @typedef {Object} SourceMetadata
 * @property {string|string[]} [headings] - Section headings
 * @property {*} [key] - Additional metadata fields
 */

/**
 * @typedef {Object} Source
 * @property {string} name - Source document name
 * @property {string} [description] - Source description
 */

/**
 * @typedef {Object} SourceData
 * @property {Source} source - Source information
 * @property {Object<string, string>|string[]} [document] - Document content by citation number
 * @property {Object<string, SourceMetadata>} [metadata] - Metadata by citation number
 */

/**
 * @typedef {Object} ErrorInfo
 * @property {"network"|"timeout"|"ratelimit"|"server"|"auth"|"client"|"unknown"} type - Error type
 * @property {string} message - User-friendly error message
 * @property {Response} [response] - HTTP response object if available
 */

/**
 * Universal Chat Widget - A floating chat interface for any OpenAI-compatible API
 * Provides a customizable chat UI with citation support, LaTeX rendering, and accessibility features
 */
class UniversalChatWidget {
  /**
   * Creates a new chat widget instance
   * @param {ChatOptions} [options={}] - Configuration options for the chat widget
   */
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

      // Header colors
      titleBackgroundColor: options.titleBackgroundColor || "#2c3532", // Header background
      titleFontColor: options.titleFontColor || "#ffffff", // Text and icons in header

      // Message bubble colors
      assistantColor: options.assistantColor || "#fdcd9a", // Assistant message bubble background
      assistantFontColor: options.assistantFontColor || "#2c3532", // Assistant text, typing dots, message preview
      assistantMessageOpacity: options.assistantMessageOpacity || 1.0, // Opacity for assistant message bubbles (0.0 to 1.0)
      userColor: options.userColor || "#99bfbb", // User message bubble and send button background
      userFontColor: options.userFontColor || "#2c3532", // Text in user message bubbles
      userMessageOpacity: options.userMessageOpacity || 1.0, // Opacity for user message bubbles (0.0 to 1.0)

      // Interface colors
      chatBackground: options.chatBackground || "#ffffff", // Chat window and input background
      stampColor: options.stampColor || "#df7d7d", // Timestamps and unread badge
      codeBackgroundColor: options.codeBackgroundColor || "#f3f4f6", // Code block backgrounds
      codeOpacity: options.codeOpacity || 0.85, // Opacity for code block backgrounds (0.0 to 1.0)
      codeTextColor: options.codeTextColor || "#2c3532", // Text color for code content
      borderColor: options.borderColor || "#2c3532", // Borders for bubbles and input
      buttonIconColor: options.buttonIconColor || "#ffffff", // Chat button icons
      scrollbarColor: options.scrollbarColor || "#d1d5db", // Scrollbar color
      inputTextColor: options.inputTextColor || "#1f2937", // Text color in input field
      inputAreaOpacity: options.inputAreaOpacity || 0.95, // Opacity for input area background (0.0 to 1.0)

      // Behavior options
      startOpen: options.startOpen || false,
      buttonSize: options.buttonSize || UniversalChatWidget.SIZES.BUTTON_SIZE,
      windowWidth: options.windowWidth || UniversalChatWidget.SIZES.WINDOW_WIDTH,
      windowHeight: options.windowHeight || UniversalChatWidget.SIZES.WINDOW_HEIGHT,
      showModelInfo: options.showModelInfo || false,

      // History management options
      maxHistoryTokens: options.maxHistoryTokens || UniversalChatWidget.LIMITS.MAX_HISTORY_TOKENS,
      alwaysKeepRecentMessages: options.alwaysKeepRecentMessages || UniversalChatWidget.LIMITS.ALWAYS_KEEP_RECENT,
      maxHistoryMessages: options.maxHistoryMessages || UniversalChatWidget.LIMITS.MAX_HISTORY_MESSAGES,

      // Debug mode (enable for development)
      debug: options.debug || false,

      ...options,
    };

    this.isOpen = false;
    this.history = [];
    this.unreadCount = 0;
    this.hasInteracted = false;
    this.traceId = null; // Will be set from sessionStorage or generated by server

    // Performance tracking
    this.debounceTimers = {};
    this.rafIds = {};

    // Error recovery
    this.lastFailedMessage = null;

    this.init();
  }

  /**
   * Timing constants for animations and delays (in milliseconds)
   * @type {Object}
   * @property {number} FOCUS_DELAY - Delay before focusing input
   * @property {number} DEBOUNCE_INPUT - Input debounce for auto-resize
   * @property {number} IOS_KEYBOARD_DELAY - Delay for iOS keyboard animations
   * @property {number} START_OPEN_DELAY - Delay before auto-opening chat
   * @property {number} HIGHLIGHT_DURATION - Duration for citation highlight
   * @property {number} COPY_SUCCESS_DURATION - Duration for "copied" indicator
   * @property {number} PREVIEW_TIMEOUT - Message preview display time
   * @property {number} PULSE_ANIMATION - Pulse animation duration
   */
  static TIMINGS = {
    FOCUS_DELAY: 100,              // Delay before focusing input
    DEBOUNCE_INPUT: 100,           // Input debounce for auto-resize
    IOS_KEYBOARD_DELAY: 300,       // Delay for iOS keyboard animations
    START_OPEN_DELAY: 1000,        // Delay before auto-opening chat
    HIGHLIGHT_DURATION: 2000,      // Duration for citation highlight
    COPY_SUCCESS_DURATION: 2000,   // Duration for "copied" indicator
    PREVIEW_TIMEOUT: 5000,         // Message preview display time
    PULSE_ANIMATION: 1500,         // Pulse animation duration
  };

  /**
   * Size constants for UI elements (in pixels)
   * @type {Object}
   * @property {number} BUTTON_SIZE - Default chat button size
   * @property {number} WINDOW_WIDTH - Default window width
   * @property {number} WINDOW_HEIGHT - Default window height
   * @property {number} MOBILE_BREAKPOINT - Mobile/desktop breakpoint
   * @property {number} MOBILE_PADDING_BOTTOM - Mobile keyboard padding
   * @property {number} SCROLLBAR_WIDTH - Scrollbar width
   * @property {number} INPUT_MAX_HEIGHT - Max input field height
   */
  static SIZES = {
    BUTTON_SIZE: 60,               // Default chat button size (px)
    WINDOW_WIDTH: 450,             // Default window width (px)
    WINDOW_HEIGHT: 600,            // Default window height (px)
    MOBILE_BREAKPOINT: 768,        // Mobile/desktop breakpoint (px)
    MOBILE_PADDING_BOTTOM: 180,    // Mobile keyboard padding (px)
    SCROLLBAR_WIDTH: 6,            // Scrollbar width (px)
    INPUT_MAX_HEIGHT: 100,         // Max input field height (px)
  };

  /**
   * Limit constants for messages, history, and content lengths
   * @type {Object}
   * @property {number} MAX_MESSAGE_LENGTH - Max characters per message
   * @property {number} MAX_HISTORY_MESSAGES - Hard limit on stored messages
   * @property {number} MAX_HISTORY_TOKENS - Token budget for API context
   * @property {number} ALWAYS_KEEP_RECENT - Recent messages never compressed
   * @property {number} SOURCE_NAME_LENGTH - Max source name length
   * @property {number} SOURCE_DESC_LENGTH - Max source description length
   * @property {number} SNIPPET_LENGTH - Citation snippet length
   * @property {number} COMPRESSED_MSG_LENGTH - Compressed message length
   * @property {number} USER_MSG_LENGTH - Compressed user message length
   * @property {number} MAX_HEADINGS_LENGTH - Max heading string length
   * @property {number} MIN_CITATION_LENGTH - Min citation text length
   * @property {number} MODEL_NAME_LENGTH - Max model name length
   * @property {number} CHARS_PER_TOKEN - Approximate chars per token
   */
  static LIMITS = {
    MAX_MESSAGE_LENGTH: 2000,      // Max characters per message
    MAX_HISTORY_MESSAGES: 100,     // Hard limit on stored messages
    MAX_HISTORY_TOKENS: 4000,      // Token budget for API context
    ALWAYS_KEEP_RECENT: 10,        // Recent messages never compressed
    SOURCE_NAME_LENGTH: 500,       // Max source name length
    SOURCE_DESC_LENGTH: 1000,      // Max source description length
    SNIPPET_LENGTH: 200,           // Citation snippet length
    COMPRESSED_MSG_LENGTH: 200,    // Compressed message length
    USER_MSG_LENGTH: 500,          // Compressed user message length
    MAX_HEADINGS_LENGTH: 100,      // Max heading string length
    MIN_CITATION_LENGTH: 15,       // Min citation text length
    MODEL_NAME_LENGTH: 50,         // Max model name length
    CHARS_PER_TOKEN: 4,            // Approximate chars per token
  };

  /**
   * Converts hex color to rgba format with specified opacity
   * @param {string} hex - Hex color code (e.g., "#ff0000")
   * @param {number} opacity - Opacity value from 0.0 to 1.0
   * @returns {string} RGBA color string (e.g., "rgba(255, 0, 0, 0.5)")
   */
  hexToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  /**
   * Escapes HTML special characters to prevent XSS attacks
   * @param {*} unsafe - Input string to escape (automatically handles non-string types)
   * @returns {string} HTML-safe string with escaped special characters
   */
  escapeHtml(unsafe) {
    if (typeof unsafe !== "string") return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Validates and sanitizes citation source data to prevent XSS and ensure data integrity
   * @param {SourceData[]} sources - Array of source data objects from API response
   * @returns {SourceData[]} Validated and sanitized array of source data
   */
  validateSources(sources) {
    if (!Array.isArray(sources)) return [];

    return sources
      .filter((sourceData) => {
        // Validate basic structure
        if (!sourceData || typeof sourceData !== "object") return false;

        // Validate source object
        if (sourceData.source && typeof sourceData.source === "object") {
          // Ensure source.name and source.description are strings
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

        // Validate document is object or array
        if (sourceData.document && typeof sourceData.document !== "object")
          return false;

        // Validate metadata is object
        if (sourceData.metadata && typeof sourceData.metadata !== "object")
          return false;

        return true;
      })
      .map((sourceData) => {
        // Sanitize by creating a clean copy with only expected fields
        const sanitized = {};

        if (sourceData.source && typeof sourceData.source === "object") {
          sanitized.source = {
            name: String(sourceData.source.name || "").substring(0, UniversalChatWidget.LIMITS.SOURCE_NAME_LENGTH),
            description: sourceData.source.description
              ? String(sourceData.source.description).substring(0, UniversalChatWidget.LIMITS.SOURCE_DESC_LENGTH)
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
   * Estimates token count for text using rough approximation (1 token ≈ 4 characters)
   * @param {string} text - Text to estimate tokens for
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    if (!text || typeof text !== "string") return 0;
    // Account for whitespace and punctuation
    return Math.ceil(text.length / UniversalChatWidget.LIMITS.CHARS_PER_TOKEN);
  }

  /**
   * Compresses a message for history by stripping formatting and keeping essential info
   * @param {ChatMessage} message - Message to compress
   * @returns {ChatMessage} Compressed message with reduced content length
   */
  compressMessage(message) {
    if (message.role === "user") {
      // Keep user messages mostly intact, just limit length
      return {
        role: "user",
        content: message.content.substring(0, UniversalChatWidget.LIMITS.USER_MSG_LENGTH),
      };
    } else {
      // For assistant messages, extract first meaningful sentence
      const content = message.content
        .replace(/```[\s\S]*?```/g, "[code]") // Replace code blocks
        .replace(/\[(\d+)\]/g, "") // Remove citations
        .replace(/[#*_]/g, "") // Remove markdown formatting
        .trim();

      // Get first sentence or first 200 chars
      const firstSentence = content.match(/^[^.!?]+[.!?]/);
      const compressed = firstSentence
        ? firstSentence[0]
        : content.substring(0, UniversalChatWidget.LIMITS.COMPRESSED_MSG_LENGTH);

      return {
        role: "assistant",
        content: compressed + (compressed.length < content.length ? "..." : ""),
      };
    }
  }

  /**
   * Optimizes conversation history for API requests using token-aware sliding window
   * Keeps recent messages in full, compresses older ones within token budget
   * @returns {ChatMessage[]} Optimized history array within token budget
   */
  optimizeHistory() {
    if (this.history.length === 0) return [];

    // Always keep recent messages in full
    const recentCount = Math.min(
      this.options.alwaysKeepRecentMessages,
      this.history.length,
    );
    const recentMessages = this.history.slice(-recentCount);
    const olderMessages = this.history.slice(0, -recentCount);

    // Calculate tokens for recent messages
    let tokenCount = recentMessages.reduce(
      (sum, msg) => sum + this.estimateTokens(msg.content),
      0,
    );

    // If we're already under budget, return all messages
    if (
      tokenCount < this.options.maxHistoryTokens &&
      olderMessages.length === 0
    ) {
      return this.history;
    }

    // Compress older messages and add them if we have token budget
    const optimized = [...recentMessages];

    for (let i = olderMessages.length - 1; i >= 0; i--) {
      const compressed = this.compressMessage(olderMessages[i]);
      const compressedTokens = this.estimateTokens(compressed.content);

      if (tokenCount + compressedTokens <= this.options.maxHistoryTokens) {
        optimized.unshift(compressed);
        tokenCount += compressedTokens;
      } else {
        break; // Stop if we exceed budget
      }
    }

    if (this.options.debug) {
      console.log(
        `History optimized: ${this.history.length} → ${optimized.length} messages (~${tokenCount} tokens)`,
      );
    }

    return optimized;
  }

  /**
   * Enforces hard limit on stored conversation history
   * Removes oldest messages when limit is exceeded
   * @returns {void}
   */
  trimHistory() {
    if (this.history.length > this.options.maxHistoryMessages) {
      const removed = this.history.length - this.options.maxHistoryMessages;
      this.history = this.history.slice(-this.options.maxHistoryMessages);

      if (this.options.debug) {
        console.log(`History trimmed: removed ${removed} oldest messages`);
      }
    }
  }

  /**
   * Debounces a function call to improve performance during rapid events
   * @param {string} key - Unique identifier for this debounced function
   * @param {Function} callback - Function to execute after delay
   * @param {number} [delay=150] - Delay in milliseconds
   * @returns {void}
   */
  debounce(key, callback, delay = 150) {
    if (this.debounceTimers[key]) {
      clearTimeout(this.debounceTimers[key]);
    }
    this.debounceTimers[key] = setTimeout(callback, delay);
  }

  /**
   * Schedules a scroll operation using requestAnimationFrame for smooth performance
   * @param {Function} callback - Scroll function to execute on next animation frame
   * @returns {void}
   */
  scheduleScroll(callback) {
    if (this.rafIds.scroll) {
      cancelAnimationFrame(this.rafIds.scroll);
    }
    this.rafIds.scroll = requestAnimationFrame(callback);
  }

  /**
   * Gets all focusable elements within the chat window for keyboard navigation
   * @returns {HTMLElement[]} Array of focusable DOM elements
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

    const elements = Array.from(this.window.querySelectorAll(focusableSelectors));

    // Debug logging (only when debug mode is enabled)
    if (this.options.debug) {
      console.log("Focusable elements found:", elements.length);
      elements.forEach((el, i) => {
        console.log(`  ${i}: ${el.tagName}.${el.className} - aria-disabled: ${el.getAttribute('aria-disabled')}, tabindex: ${el.getAttribute('tabindex')}`);
      });
    }

    return elements;
  }

  /**
   * Traps keyboard focus within chat window for better accessibility
   * Ensures Tab navigation cycles through focusable elements and doesn't escape to browser UI
   * @param {KeyboardEvent} e - Keyboard event
   * @returns {void}
   */
  trapFocus(e) {
    // Only trap focus when window is open and Tab key is pressed
    if (!this.isOpen || e.key !== "Tab") return;

    e.preventDefault(); // Always prevent default Tab behavior

    const focusableElements = this.getFocusableElements();
    if (focusableElements.length === 0) return;

    const activeElement = document.activeElement;
    const currentIndex = focusableElements.indexOf(activeElement);

    if (this.options.debug) {
      console.log(`Tab pressed! Shift: ${e.shiftKey}, Current element:`, activeElement.className, `Index: ${currentIndex}`);
    }

    // If current element is not in the list or outside chat, start from beginning/end
    if (currentIndex === -1) {
      if (this.options.debug) {
        console.log("Current element not in list, resetting to start/end");
      }
      if (e.shiftKey) {
        focusableElements[focusableElements.length - 1].focus();
      } else {
        focusableElements[0].focus();
      }
      return;
    }

    // Calculate next index with wrapping
    let nextIndex;
    if (e.shiftKey) {
      // Shift+Tab: go backwards, wrap to end if at start
      nextIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
    } else {
      // Tab: go forwards, wrap to start if at end
      nextIndex = currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1;
    }

    if (this.options.debug) {
      console.log(`Moving from index ${currentIndex} to ${nextIndex}:`, focusableElements[nextIndex].className);
    }
    focusableElements[nextIndex].focus();
  }

  /**
   * Sets up focus trap event listener for accessibility
   * Prevents Tab key from escaping chat window to browser UI
   * @returns {void}
   */
  setupFocusTrap() {
    this.focusTrapHandler = (e) => this.trapFocus(e);
    document.addEventListener("keydown", this.focusTrapHandler);
  }

  /**
   * Removes focus trap event listener and cleans up
   * @returns {void}
   */
  removeFocusTrap() {
    if (this.focusTrapHandler) {
      document.removeEventListener("keydown", this.focusTrapHandler);
      this.focusTrapHandler = null;
    }
  }

  /**
   * Detects and categorizes error type from fetch error or HTTP response
   * @param {Error} error - JavaScript error object
   * @param {Response} [response] - HTTP response object (if available)
   * @returns {ErrorInfo} Error information with type and user-friendly message
   */
  detectErrorType(error, response) {
    // Network errors (no internet, DNS failure, etc.)
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return {
        type: "network",
        message: "🔌 Connection lost. Check your internet and try again.",
      };
    }

    // Timeout errors
    if (error.name === "AbortError") {
      return {
        type: "timeout",
        message: "Request timed out. The server took too long to respond.",
      };
    }

    // HTTP error responses
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

    // Generic error
    return {
      type: "unknown",
      message: "Something went wrong. Please try again.",
    };
  }

  /**
   * Retries sending the last failed message
   * @returns {Promise<void>}
   */
  async retryLastMessage() {
    if (!this.lastFailedMessage) return;

    const message = this.lastFailedMessage;
    this.lastFailedMessage = null;

    // Remove the error message
    const errorMessages = this.messagesEl.querySelectorAll(".message.error");
    errorMessages.forEach((msg) => msg.remove());

    // Resend the message
    await this.sendMessage(message);
  }

  /**
   * Adds copy buttons to all code blocks within a message element
   * @param {HTMLElement} messageElement - Message DOM element containing code blocks
   * @returns {void}
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
          copyBtn.textContent = "✓";
          copyBtn.classList.add("copied");

          setTimeout(() => {
            copyBtn.textContent = "⧉";
            copyBtn.classList.remove("copied");
          }, UniversalChatWidget.TIMINGS.COPY_SUCCESS_DURATION);
        } catch (err) {
          // Fallback for older browsers
          const textArea = document.createElement("textarea");
          textArea.value = textToCopy;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);

          copyBtn.textContent = "✓";
          copyBtn.classList.add("copied");

          setTimeout(() => {
            copyBtn.textContent = "⧉";
            copyBtn.classList.remove("copied");
          }, UniversalChatWidget.TIMINGS.COPY_SUCCESS_DURATION);
        }
      });

      codeBlock.appendChild(copyBtn);
    });
  }

  /**
   * Dynamically loads KaTeX library for LaTeX math rendering
   * @returns {Promise<void>} Promise that resolves when KaTeX is loaded
   */
  loadKaTeX() {
    return new Promise((resolve) => {
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
  }

  /**
   * Renders LaTeX mathematical expressions in a message element
   * @param {HTMLElement} messageElement - Message DOM element containing LaTeX
   * @returns {Promise<void>}
   */
  async renderLatex(messageElement) {
    await this.loadKaTeX();

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
   * Renders citations in a message with clickable links and reference sections
   * Supports both structured source data and inline citation parsing
   * @param {HTMLElement} messageElement - Message DOM element to process
   * @param {SourceData[]} [sources=[]] - Array of source data with documents and metadata
   * @returns {void}
   */
  renderCitations(messageElement, sources = []) {
    const messageBubble = messageElement.querySelector(".message-bubble");
    if (!messageBubble) return;

    // Validate and sanitize sources first
    sources = this.validateSources(sources);

    let content = messageBubble.innerHTML;
    const citations = {};

    // First extract citation numbers that actually appear in the content
    const citationMatches = content.match(/\[(\d+)\]/g);
    const citationNumbers = citationMatches
      ? citationMatches.map((match) => parseInt(match.slice(1, -1)))
      : [];

    // First try to use structured sources if provided
    if (sources && sources.length > 0 && citationNumbers.length > 0) {
      // Extract citations from sources data only for numbers that appear in content
      sources.forEach((sourceData, sourceIndex) => {
        const source = sourceData.source;
        const document = sourceData.document;
        const metadata = sourceData.metadata;

        if (document) {
          // Only process document fragments for citation numbers that appear in the text
          citationNumbers.forEach((citationNum) => {
            // Use citation number as key to find the corresponding document
            const docKey = citationNum.toString();
            const docContent = document[docKey] || document[citationNum - 1];
            if (docContent && typeof docContent === "string") {
              // Create reference text from source metadata and document content
              // SECURITY: All content is escaped to prevent XSS
              let referenceText = `<strong>${this.escapeHtml(source.name)}</strong>`;
              if (source.description) {
                referenceText += ` - ${this.escapeHtml(source.description)}`;
              }

              // Add metadata info if available
              if (metadata && metadata[docKey]) {
                const metaInfo = metadata[docKey];
                if (metaInfo.headings && metaInfo.headings !== "[]") {
                  try {
                    let headings = [];

                    // Parse Python-style list format with regex
                    if (
                      typeof metaInfo.headings === "string" &&
                      metaInfo.headings.startsWith("[") &&
                      metaInfo.headings.endsWith("]")
                    ) {
                      // Extract content between quotes using regex
                      const matches = metaInfo.headings.match(/'([^']*)'/g);
                      if (matches) {
                        headings = matches.map((match) => match.slice(1, -1)); // Remove surrounding quotes
                      }
                    }

                    if (headings.length > 0) {
                      // SECURITY: Escape each heading
                      const escapedHeadings = headings
                        .map((h) => this.escapeHtml(h))
                        .join(" &gt; ");
                      referenceText += `<br><strong>Section:</strong> ${escapedHeadings}`;
                    }
                  } catch (parseError) {
                    console.warn(
                      "Failed to parse headings:",
                      metaInfo.headings,
                      parseError,
                    );
                    // Fallback: just show the raw headings string if it's reasonable
                    if (
                      typeof metaInfo.headings === "string" &&
                      metaInfo.headings.length < UniversalChatWidget.LIMITS.MAX_HEADINGS_LENGTH
                    ) {
                      referenceText += `<br><strong>Section:</strong> ${this.escapeHtml(metaInfo.headings)}`;
                    }
                  }
                }
              }

              // Add document snippet
              // SECURITY: Escape the snippet content
              const snippet = String(docContent)
                .substring(0, UniversalChatWidget.LIMITS.SNIPPET_LENGTH)
                .replace(/[#*-]/g, "")
                .replace(/\s+/g, " ")
                .trim();
              if (snippet) {
                referenceText += `<br><em>${this.escapeHtml(snippet)}...</em>`;
              }

              citations[citationNum] = referenceText;
            }
          });
        }
      });
    } else if (citationNumbers.length === 0 && sources && sources.length > 0) {
      // Fallback: Parse citations from text content
      const citationPattern = /\[(\d+)\]\s*([\s\S]*?)(?=\s*\[\d+\]|$)/g;
      let match;

      while ((match = citationPattern.exec(content)) !== null) {
        const citationNum = parseInt(match[1]);
        const referenceText = match[2].trim();

        // Clean and check if it's substantial content
        const cleanText = referenceText
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        if (cleanText.length > UniversalChatWidget.LIMITS.MIN_CITATION_LENGTH) {
          citations[citationNum] = referenceText;

          // Replace this citation with a clickable link (keyboard accessible)
          const replacement = `<span class="citation-link" data-citation="${citationNum}" title="Click to see reference" role="button" tabindex="0" aria-label="View reference ${citationNum}">[${citationNum}]</span>`;
          content = content.replace(match[0], replacement);

          // Reset regex position since we modified the string
          citationPattern.lastIndex = 0;
        }
      }
    }

    // Replace citation numbers with clickable links (for structured sources or remaining citations)
    content = content.replace(/\[(\d+)\]/g, (match, num) => {
      const citationNum = parseInt(num);
      if (citations[citationNum]) {
        return `<span class="citation-link" data-citation="${citationNum}" title="Click to see reference" role="button" tabindex="0" aria-label="View reference ${citationNum}">[${citationNum}]</span>`;
      }
      return match;
    });

    // If we have citations, create references section

    if (Object.keys(citations).length > 0) {
      let referencesHtml =
        '<div class="references-section"><h4>References:</h4><ol class="references-list">';

      const sortedNums = Object.keys(citations).sort(
        (a, b) => parseInt(a) - parseInt(b),
      );
      sortedNums.forEach((num) => {
        referencesHtml += `<li id="ref-${num}" class="reference-item">${citations[num]}</li>`;
      });

      referencesHtml += "</ol></div>";
      content += referencesHtml;

      messageBubble.innerHTML = content;

      // Add click and keyboard handlers for citation links
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
            }, UniversalChatWidget.TIMINGS.HIGHLIGHT_DURATION);
          }
        };

        link.addEventListener("click", (e) => {
          const citationNum = e.target.dataset.citation;
          scrollToReference(citationNum);
        });

        // Keyboard accessibility: Enter and Space keys
        link.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault(); // Prevent page scroll on Space
            const citationNum = e.target.dataset.citation;
            scrollToReference(citationNum);
          }
        });
      });
    }
  }

  /**
   * Validates API endpoint URL for security and format
   * Only accepts HTTP/HTTPS protocols to prevent security risks
   * @param {string} endpoint - API endpoint URL to validate
   * @returns {string|null} Valid endpoint URL or null if invalid
   */
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

  /**
   * Validates and sanitizes AI model name for security
   * Restricts to alphanumeric characters, hyphens, underscores, and dots only
   * @param {string} model - AI model name to validate
   * @returns {string|null} Valid model name (truncated to limit) or null if invalid
   */
  validateModel(model) {
    if (!model || typeof model !== "string") return null;
    // Allow alphanumeric, hyphens, underscores, and dots only
    if (!/^[a-zA-Z0-9\-_.]+$/.test(model)) {
      console.warn("Chat Widget: Invalid model name provided");
      return null;
    }
    return model.substring(0, UniversalChatWidget.LIMITS.MODEL_NAME_LENGTH);
  }

  /**
   * Ensures proper viewport meta tag exists for mobile compatibility
   * Adds viewport-fit=cover for iOS safe area support (notch/home indicator)
   * @returns {void}
   */
  ensureViewportMeta() {
    // Check if viewport meta tag exists and includes viewport-fit=cover
    let viewportMeta = document.querySelector('meta[name="viewport"]');

    if (!viewportMeta) {
      // Create viewport meta tag if it doesn't exist
      viewportMeta = document.createElement("meta");
      viewportMeta.name = "viewport";
      viewportMeta.content =
        "width=device-width, initial-scale=1.0, viewport-fit=cover";
      document.head.appendChild(viewportMeta);
    } else if (!viewportMeta.content.includes("viewport-fit=cover")) {
      // Add viewport-fit=cover if not present
      viewportMeta.content = viewportMeta.content + ", viewport-fit=cover";
    }
  }

  /**
   * Initializes the chat widget by setting up viewport, styles, DOM, events, and state
   * Optionally auto-opens the chat window if configured with startOpen option
   * @returns {void}
   */
  init() {
    this.ensureViewportMeta();
    this.injectStyles();
    this.createWidget();
    this.bindEvents();
    this.restoreState();

    if (this.options.startOpen && !this.hasInteracted) {
      setTimeout(() => this.open(), UniversalChatWidget.TIMINGS.START_OPEN_DELAY);
    }
  }

  /**
   * Injects CSS styles for the chat widget into the document head
   * Only injects once (checks for existing styles), applies all theme colors and responsive behavior
   * @returns {void}
   */
  injectStyles() {
    if (document.getElementById("universal-chat-styles")) return;

    // Use solid color only - no gradients
    const backgroundStyle = this.options.userColor;
    const headerBackgroundStyle = this.options.titleBackgroundColor;

    const styles = document.createElement("style");
    styles.id = "universal-chat-styles";
    styles.textContent = `

      /* Import Google Fonts and KaTeX */
      @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500&display=swap');
      @import url('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css');


      /* Chat Button */
      .universal-chat-button {
        position: fixed;
        ${this.options.position.includes("right") ? "right: 20px" : "left: 20px"};
        ${this.options.position.includes("bottom") ? "bottom: 20px" : "top: 20px"};
        width: ${this.options.buttonSize}px;
        height: ${this.options.buttonSize}px;
        border-radius: 2px;
        background: ${this.options.assistantColor};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        z-index: 9998;
        border: none;
        color: ${this.options.buttonIconColor};
        font-size: 28px;
      }

      /* Unified hover and focus styles for chat button */
      .universal-chat-button:hover,
      .universal-chat-button:focus {
        background: ${this.options.stampColor};
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
      }

      .universal-chat-button.chat-open {
        transform: rotate(90deg);
        background: ${this.options.userColor};
      }

      .universal-chat-button.chat-open:hover,
      .universal-chat-button.chat-open:focus {
        background: ${this.options.stampColor};
        transform: rotate(90deg) scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
      }

      /* Unread Badge */
      .chat-unread-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: ${this.options.assistantColor};
        color: ${this.options.stampColor};
        border-radius: 2px;
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
        background: ${this.options.chatBackground};
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
        background: ${this.options.assistantFontColor};
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
        background: ${this.options.chatBackground};
        padding: 8px 12px;
        border-radius: 2px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        max-width: 250px;
        font-size: 14px;
        color: ${this.options.assistantFontColor};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        animation: slideIn 0.3s ease;
      }

      /* Chat Window */
      .universal-chat-window {
        position: fixed;
        ${this.options.position.includes("right") ? "right: 20px" : "left: 20px"};
        ${this.options.position.includes("bottom") ? `bottom: ${this.options.buttonSize + 40}px` : `top: ${this.options.buttonSize + 40}px`};
        width: ${this.options.windowWidth}px;
        height: ${this.options.windowHeight}px;
        max-height: calc(100vh - ${this.options.buttonSize + 60}px);
        background: ${this.options.chatBackground};
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

      /* Header */
      .chat-header {
        background: ${headerBackgroundStyle};
        color: ${this.options.titleFontColor};
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
        color: ${this.options.titleFontColor};
      }

      .chat-header-actions {
        display: flex;
        gap: 0.5rem;
      }

      .chat-header-btn {
        background: transparent;
        border: none;
        color: ${this.options.titleFontColor};
        width: 44px;
        height: 44px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s;
        font-size: 28px;
      }

      /* Unified hover and focus styles for header buttons */
      .chat-header-btn:hover,
      .chat-header-btn:focus {
        color: ${this.options.stampColor} !important;
        transform: scale(1.1);
        opacity: 1 !important;
        outline: none !important;
      }

      /* Messages */
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        padding-bottom: ${UniversalChatWidget.SIZES.INPUT_MAX_HEIGHT}px;
        background: ${this.options.chatBackground};
        scroll-behavior: smooth;
      }

      .chat-messages::-webkit-scrollbar {
        width: ${UniversalChatWidget.SIZES.SCROLLBAR_WIDTH}px;
      }

      .chat-messages::-webkit-scrollbar-thumb {
        background: ${this.options.scrollbarColor};
        border-radius: 2px;
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
        color: ${this.options.assistantFontColor};
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
        background: color-mix(in srgb, ${this.options.userColor}, transparent ${(1 - this.options.userMessageOpacity) * 100}%);
        border: 1px solid ${this.options.borderColor};
        color: ${this.options.userFontColor};
        border-radius: 2px;
        text-align: left;
      }


      .message.assistant .message-bubble {
        background: color-mix(in srgb, ${this.options.assistantColor}, transparent ${(1 - this.options.assistantMessageOpacity) * 100}%);
        border: 1px solid ${this.options.borderColor};
        border-radius: 2px;
        color: ${this.options.assistantFontColor};
      }

      .message-time {
        font-size: 0.7rem;
        color: ${this.options.stampColor};
        margin-top: 0.25rem;
      }

      .typing-indicator {
        display: inline-block;
        padding: 0.75rem 1rem;
        background: color-mix(in srgb, ${this.options.assistantColor}, transparent ${(1 - this.options.assistantMessageOpacity) * 100}%);
        border: 1px solid ${this.options.borderColor};
        border-radius: 2px;
      }

      .typing-indicator span {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${this.options.assistantFontColor};
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
        background: ${this.hexToRgba(this.options.chatBackground, this.options.inputAreaOpacity)};
        border-radius: 2px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10;
      }

      .chat-input-container {
        display: flex;
        border: 1px solid ${this.options.borderColor};
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
        max-height: ${UniversalChatWidget.SIZES.INPUT_MAX_HEIGHT}px;
        background: transparent;
        color: ${this.options.inputTextColor};
      }

      .chat-send-btn {
        padding: 0.75rem 1rem;
        background: ${backgroundStyle};
        color: ${this.options.userFontColor};
        border: none;
        border-left: 1px solid ${this.options.borderColor};
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

      /* Unified hover and focus styles for send button */
      .chat-send-btn:hover:not(:disabled):not([aria-disabled="true"]),
      .chat-send-btn:focus:not(:disabled):not([aria-disabled="true"]) {
        background: ${this.options.stampColor} !important;
        transform: scale(1.05);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        outline: none !important;
      }

      .chat-send-btn:disabled,
      .chat-send-btn[aria-disabled="true"] {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Disabled button should not show hover/focus effects */
      .chat-send-btn:disabled:hover,
      .chat-send-btn:disabled:focus,
      .chat-send-btn[aria-disabled="true"]:hover,
      .chat-send-btn[aria-disabled="true"]:focus {
        transform: none !important;
        box-shadow: none !important;
        background: ${backgroundStyle} !important;
      }

      /* Model info badge */
      .model-info {
        font-size: 0.7rem;
        color: ${this.options.stampColor};
        text-align: center;
        padding: 0.25rem;
        background: ${this.hexToRgba(this.options.codeBackgroundColor, this.options.codeOpacity)};
        margin: 0 1rem;
        border-radius: 2px;
      }

      /* Touch device interactions - match desktop hover appearance */
      @media (hover: none) and (pointer: coarse) {
        /* Chat button - apply desktop hover styles on tap */
        .universal-chat-button:active {
          background: ${this.options.stampColor};
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        }

        .universal-chat-button.chat-open:active {
          background: ${this.options.stampColor};
          transform: rotate(90deg) scale(1.1);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        }

        /* Header buttons */
        .chat-header-btn:active {
          color: ${this.options.stampColor} !important;
          transform: scale(1.1);
          opacity: 1 !important;
        }

        /* Send button */
        .chat-send-btn:active:not(:disabled):not([aria-disabled="true"]) {
          background: ${this.options.stampColor} !important;
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        /* Code copy buttons */
        .code-copy-btn:active {
          background: ${this.options.stampColor};
          transform: scale(1.05);
        }

        /* Make code copy buttons always visible on touch devices */
        .message-bubble pre .code-copy-btn {
          opacity: 1;
        }

        /* Citation links */
        .citation-link:active {
          background: ${this.options.stampColor};
          color: ${this.options.titleFontColor};
          transform: scale(1.05);
        }

        /* Retry button */
        .retry-btn:active:not(:disabled) {
          background: ${this.options.stampColor};
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
      }

      /* Mobile Fullscreen */
      @media (max-width: ${UniversalChatWidget.SIZES.MOBILE_BREAKPOINT}px) {
        .universal-chat-window {
          width: 100vw !important;
          height: 100vh !important;
          height: 100dvh !important; /* Dynamic viewport height for better keyboard handling */
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
          border: 1px solid ${this.options.borderColor};
        }

        .chat-input {
          font-size: 16px !important; /* Prevents iOS zoom on focus */
        }
      }

      /* Markdown support */
      .message-bubble code {
        background: ${this.hexToRgba(this.options.codeBackgroundColor, this.options.codeOpacity)};
        padding: 0.125rem 0.25rem;
        border-radius: 2px;
        font-family: 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.9em;
        color: ${this.options.codeTextColor};
        word-break: break-all;
        white-space: pre-wrap;
      }

      .message.user .message-bubble code {
        background: ${this.hexToRgba(this.options.codeBackgroundColor, this.options.codeOpacity)};
        color: ${this.options.codeTextColor};
      }

      .message-bubble pre {
        background: ${this.hexToRgba(this.options.codeBackgroundColor, this.options.codeOpacity)};
        color: ${this.options.codeTextColor};
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
        border: 1px solid ${this.options.borderColor};
      }

      .message-bubble pre code {
        background: transparent;
        padding: 0;
        color: inherit;
        word-break: inherit;
        white-space: inherit;
      }

      /* Copy button for code blocks */
      .code-copy-btn {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        background: ${this.options.borderColor};
        color: ${this.options.titleFontColor};
        border: none;
        border-radius: 4px;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s ease;
        z-index: 1;
      }

      /* Unified hover and focus styles for code copy button */
      .code-copy-btn:hover,
      .code-copy-btn:focus {
        background: ${this.options.stampColor};
        transform: scale(1.05);
        outline: none;
      }

      .message-bubble pre:hover .code-copy-btn {
        opacity: 1;
      }

      .code-copy-btn.copied {
        background: ${this.options.assistantColor};
        color: ${this.options.assistantFontColor};
      }

      /* KaTeX styling */
      .katex {
        font-size: 1.1em;
      }

      .katex-display {
        margin: 1em 0;
        text-align: center;
      }

      .katex-error {
        color: ${this.options.stampColor};
        border: 1px solid ${this.options.stampColor};
        padding: 0.25rem;
        border-radius: 3px;
        background: ${this.hexToRgba(this.options.codeBackgroundColor, this.options.codeOpacity)};
      }

      /* Citation styling */
      .citation-link {
        color: ${this.options.codeTextColor};
        cursor: pointer;
        text-decoration: none;
        font-weight: 500;
        padding: 1px 3px;
        border-radius: 2px;
        transition: all 0.2s ease;
        font-size: 0.85em;
      }

      /* Unified hover and focus styles for citation links */
      .citation-link:hover,
      .citation-link:focus {
        background: ${this.options.stampColor};
        color: ${this.options.titleFontColor};
        transform: scale(1.05);
        outline: none;
      }

      .references-section {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid ${this.options.borderColor};
      }

      .references-section h4 {
        margin: 0 0 1rem 0;
        font-size: 1rem;
        font-weight: 600;
        color: ${this.options.assistantFontColor};
      }

      .references-list {
        margin: 0;
        padding-left: 1rem;
        font-size: 0.75em;
      }

      .reference-item {
        margin-bottom: 0.5rem;
        color: ${this.options.assistantFontColor};
        transition: background-color 0.3s ease;
        text-align: justify;
      }

      .reference-item.highlighted {
        background: ${this.hexToRgba(this.options.codeBackgroundColor, this.options.codeOpacity)};
        padding: 0.5rem;
        border-radius: 2px;
        border-left: 2px solid ${this.options.userColor};
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

      /* Screen reader only content */
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

      /* Text selection styling for consistency across devices */
      .universal-chat-window ::selection {
        background: ${this.hexToRgba(this.options.userColor, 0.3)};
        color: ${this.options.assistantFontColor};
      }

      .universal-chat-window ::-moz-selection {
        background: ${this.hexToRgba(this.options.userColor, 0.3)};
        color: ${this.options.assistantFontColor};
      }

      /* Input field focus style - red blinking cursor, no border */
      .chat-input:focus {
        outline: none !important;
        caret-color: ${this.options.stampColor};
      }

      /* Remove the container focus style as well */
      .chat-input-container:focus-within {
        box-shadow: none !important;
      }

      /* Fallback removed - we now use :focus directly for all elements */

      /* Error message styles */
      .message.error {
        text-align: center;
        margin: 1rem 0;
      }

      .message.error .message-bubble {
        background: ${this.hexToRgba(this.options.stampColor, 0.1)};
        border: 1px solid ${this.options.stampColor};
        color: ${this.options.assistantFontColor};
        padding: 1rem;
        max-width: 100%;
      }

      .retry-btn {
        margin-top: 0.75rem;
        padding: 0.5rem 1rem;
        background: ${this.options.userColor};
        color: ${this.options.userFontColor};
        border: 1px solid ${this.options.borderColor};
        border-radius: 2px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      /* Unified hover and focus styles for retry button */
      .retry-btn:hover:not(:disabled),
      .retry-btn:focus:not(:disabled) {
        background: ${this.options.stampColor};
        transform: scale(1.05);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        outline: none;
      }

      .retry-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Creates and appends the chat widget DOM elements (button and window) to the document
   * Sets up accessibility attributes, initial welcome message, and references to key elements
   * @returns {void}
   */
  createWidget() {
    // Create button
    this.button = document.createElement("button");
    this.button.className = "universal-chat-button";
    this.button.innerHTML = "💬";
    this.button.setAttribute("aria-label", "Open chat. Press Enter to open, Escape to close");
    this.button.setAttribute("aria-expanded", "false");
    this.button.setAttribute("aria-haspopup", "dialog");
    this.button.setAttribute("tabindex", "0");
    this.button.title = "Open chat (Enter)";

    // Add unread badge
    this.unreadBadge = document.createElement("span");
    this.unreadBadge.className = "chat-unread-badge";
    this.unreadBadge.style.display = "none";
    this.unreadBadge.setAttribute("aria-label", "unread messages");
    this.button.appendChild(this.unreadBadge);

    // Add typing indicator for button
    this.buttonTypingIndicator = document.createElement("div");
    this.buttonTypingIndicator.className = "button-typing-indicator";
    this.buttonTypingIndicator.innerHTML =
      "<span></span><span></span><span></span>";
    this.buttonTypingIndicator.style.display = "none";
    this.buttonTypingIndicator.setAttribute("role", "status");
    this.buttonTypingIndicator.setAttribute(
      "aria-label",
      "Assistant is typing",
    );
    this.button.appendChild(this.buttonTypingIndicator);

    // Create window
    this.window = document.createElement("div");
    this.window.className = "universal-chat-window";
    this.window.setAttribute("role", "dialog");
    this.window.setAttribute("aria-label", this.options.title);
    this.window.setAttribute("aria-modal", "false"); // Changed to true on mobile
    this.window.innerHTML = `
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
      <div class="chat-messages" role="log" aria-live="polite" aria-atomic="false" aria-label="Chat conversation">
        <div class="message assistant" role="article" aria-label="Message from assistant">
          <div class="message-bubble">${this.options.welcomeMessage}</div>
          <div class="message-time" aria-label="sent at ${this.formatTime(new Date())}">${this.formatTime(new Date())}</div>
        </div>
      </div>
      <div class="chat-input-area">
        <div class="chat-input-container">
          <textarea
            class="chat-input"
            placeholder="${this.options.placeholder}"
            maxlength="${UniversalChatWidget.LIMITS.MAX_MESSAGE_LENGTH}"
            rows="1"
            aria-label="Type your message. Press Enter to send, Shift+Enter for new line"
            aria-describedby="char-limit keyboard-hints"></textarea>
          <button class="chat-send-btn" tabindex="-1" aria-disabled="true" aria-label="Send message (Enter)">
            Send
          </button>
        </div>
        <div id="char-limit" class="sr-only">Maximum ${UniversalChatWidget.LIMITS.MAX_MESSAGE_LENGTH} characters</div>
        <div id="keyboard-hints" class="sr-only">Keyboard shortcuts: Enter to send, Shift+Enter for new line, Escape to close chat</div>
      </div>
    `;

    document.body.appendChild(this.button);
    document.body.appendChild(this.window);

    this.messagesEl = this.window.querySelector(".chat-messages");
    this.inputEl = this.window.querySelector(".chat-input");
    this.sendBtn = this.window.querySelector(".chat-send-btn");
    this.modelInfoEl = this.window.querySelector("#model-info");

    // Add copy buttons to welcome message
    this.addCopyButtonsToCodeBlocks(this.messagesEl);

    // Render LaTeX in welcome message
    this.renderLatex(this.messagesEl);

    // Render citations in welcome message
    this.renderCitations(this.messagesEl.querySelector(".message"), []);
  }

  /**
   * Binds all event listeners for user interactions
   * Handles button clicks, input events, keyboard shortcuts, and mobile keyboard behavior
   * @returns {void}
   */
  bindEvents() {
    this.button.addEventListener("click", () => this.toggle());
    this.window
      .querySelector(".chat-close-btn")
      .addEventListener("click", () => this.close());
    this.window
      .querySelector(".chat-clear-btn")
      .addEventListener("click", () => this.clearChat());
    this.sendBtn.addEventListener("click", () => {
      // Don't send if button is aria-disabled
      if (this.sendBtn.getAttribute("aria-disabled") === "true") return;
      this.sendMessage();
    });

    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // Only send if button is not aria-disabled
        if (this.sendBtn.getAttribute("aria-disabled") !== "true") {
          this.sendMessage();
        }
      }
    });

    this.inputEl.addEventListener("input", () => {
      const hasText = this.inputEl.value.trim().length > 0;
      this.sendBtn.setAttribute("aria-disabled", hasText ? "false" : "true");
      this.sendBtn.setAttribute("tabindex", hasText ? "0" : "-1");
      // Debounce auto-resize for better performance during rapid typing
      this.debounce("autoResize", () => this.autoResizeInput(), UniversalChatWidget.TIMINGS.DEBOUNCE_INPUT);
    });

    // iOS keyboard handling
    this.inputEl.addEventListener("focus", () => {
      setTimeout(() => {
        this.inputEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        // Adjust messages padding to prevent content from being hidden
        if (window.innerWidth <= UniversalChatWidget.SIZES.MOBILE_BREAKPOINT) {
          this.messagesEl.style.paddingBottom = `${UniversalChatWidget.SIZES.MOBILE_PADDING_BOTTOM}px`;
        }
      }, UniversalChatWidget.TIMINGS.IOS_KEYBOARD_DELAY);
    });

    this.inputEl.addEventListener("blur", () => {
      if (window.innerWidth <= UniversalChatWidget.SIZES.MOBILE_BREAKPOINT) {
        this.messagesEl.style.paddingBottom = "";
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
    });
  }

  /**
   * Automatically adjusts input textarea height based on content
   * Limits height to INPUT_MAX_HEIGHT to prevent excessive expansion
   * @returns {void}
   */
  autoResizeInput() {
    this.inputEl.style.height = "auto";
    this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, UniversalChatWidget.SIZES.INPUT_MAX_HEIGHT) + "px";
  }

  /**
   * Toggles chat window visibility between open and closed states
   * @returns {void}
   */
  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  /**
   * Opens the chat window with animations and accessibility updates
   * Sets focus to input field, clears unread count, and sets up focus trap for keyboard navigation
   * @returns {void}
   */
  open() {
    this.isOpen = true;
    this.hasInteracted = true;
    this.window.classList.add("open");
    this.button.classList.add("chat-open");
    this.button.innerHTML = "×";
    this.button.setAttribute("aria-label", "Close chat. Press Escape or Enter to close");
    this.button.setAttribute("aria-expanded", "true");
    this.button.setAttribute("tabindex", "-1"); // Remove from tab order when chat is open
    this.button.title = "Close chat (Escape)";

    // Set aria-modal to true since focus is trapped
    this.window.setAttribute("aria-modal", "true");

    this.unreadCount = 0;
    this.updateUnreadBadge();
    this.hideMessagePreview();
    this.buttonTypingIndicator.style.display = "none";

    // Focus management: move focus to input field
    setTimeout(() => {
      this.inputEl.focus();
    }, UniversalChatWidget.TIMINGS.FOCUS_DELAY);

    // Set up focus trap to prevent Tab from escaping to browser UI
    this.setupFocusTrap();

    this.saveState();
  }

  /**
   * Closes the chat window with animations and accessibility updates
   * Returns focus to chat button, removes focus trap, and saves state
   * @returns {void}
   */
  close() {
    this.isOpen = false;
    this.window.classList.remove("open");
    this.button.classList.remove("chat-open");
    this.button.innerHTML = "💬";
    this.button.setAttribute("aria-label", "Open chat. Press Enter to open, Escape to close");
    this.button.setAttribute("aria-expanded", "false");
    this.button.setAttribute("tabindex", "0"); // Restore to tab order when chat is closed
    this.button.title = "Open chat (Enter)";
    this.window.setAttribute("aria-modal", "false");

    // Remove focus trap
    this.removeFocusTrap();

    // Focus management: return focus to button
    this.button.focus();

    this.saveState();
  }

  /**
   * Sends a user message to the API endpoint and handles the response
   * Manages history optimization, error handling, retry logic, and citation rendering
   * @param {string|null} [retryMessage=null] - Optional message for retry (uses input value if null)
   * @returns {Promise<void>}
   */
  async sendMessage(retryMessage = null) {
    // Get message from input or use retry message
    const message = retryMessage || this.inputEl.value.trim();
    if (!message) return;

    // Only add user message and clear input if not a retry
    if (!retryMessage) {
      this.addMessage("user", message);
      this.inputEl.value = "";
      this.autoResizeInput();
      this.sendBtn.setAttribute("aria-disabled", "true");
      this.sendBtn.setAttribute("tabindex", "-1");
    }

    this.showTyping();

    if (this.options.debug) {
      console.log("Client sending traceId:", this.traceId);
    }

    let response = null;
    try {
      // Optimize history for API request (token-aware sliding window)
      const optimizedHistory = this.optimizeHistory();

      response = await fetch(this.options.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          history: optimizedHistory,
          model: this.options.model,
          traceId: this.traceId, // Include trace ID for conversation continuity
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Detect specific error type from response
        const errorInfo = this.detectErrorType(
          new Error(data.error || "Request failed"),
          response,
        );
        throw { ...errorInfo, response };
      }

      // Store trace ID from server response for conversation continuity
      if (data.traceId) {
        this.traceId = data.traceId;
        if (this.options.debug) {
          console.log("Client received traceId from server:", data.traceId);
        }
      }

      // Update model info if available
      if (this.modelInfoEl && data.model) {
        this.modelInfoEl.textContent = `Model: ${data.model}`;
      }

      // Extract content and sources from API response
      const assistantContent =
        data.choices?.[0]?.message?.content || data.response;

      // Extract sources from nested API structure - try multiple possible paths
      let sources = [];

      // Try different possible source paths
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

      // Debug logging
      if (this.options.debug) {
        console.log("API Response:", data);
        console.log("Sources found:", sources);
        console.log("Content:", assistantContent);

        // Check for citation numbers in content
        const citationMatches = assistantContent.match(/\[(\d+)\]/g);
        console.log("Citation numbers found in content:", citationMatches);
      }

      this.history.push(
        { role: "user", content: message },
        { role: "assistant", content: assistantContent },
      );

      // Enforce hard limit on stored messages
      this.trimHistory();

      this.hideTyping();
      this.addMessage("assistant", assistantContent, sources);

      if (!this.isOpen) {
        this.unreadCount++;
        this.updateUnreadBadge();
        this.showMessagePreview(data.response);
        this.button.style.animation = "pulse 0.5s ease 3";
        setTimeout(() => {
          this.button.style.animation = "";
        }, UniversalChatWidget.TIMINGS.PULSE_ANIMATION);
      }

      // Clear last failed message on success
      this.lastFailedMessage = null;

      this.saveState();
    } catch (error) {
      console.error("Chat error:", error);
      this.hideTyping();

      // Detect error type
      const errorInfo = error.type
        ? error
        : this.detectErrorType(error, response);

      // Store message for retry
      this.lastFailedMessage = message;

      // Create error message with retry button
      const errorEl = document.createElement("div");
      errorEl.className = "message error";
      errorEl.setAttribute("role", "alert");
      errorEl.innerHTML = `
        <div class="message-bubble">
          ${errorInfo.message}
          <br>
          <button class="retry-btn" aria-label="Retry sending message">
            ↻ Retry
          </button>
        </div>
      `;

      this.messagesEl.appendChild(errorEl);

      // Add retry button handler
      const retryBtn = errorEl.querySelector(".retry-btn");
      retryBtn.addEventListener("click", async () => {
        retryBtn.disabled = true;
        retryBtn.textContent = "Retrying...";
        await this.retryLastMessage();
      });

      // Smooth scroll to error message
      this.scheduleScroll(() => {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      });
    }

    this.inputEl.focus();
  }

  /**
   * Displays animated typing indicator in chat and on button when chat is closed
   * @returns {void}
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
    this.messagesEl.appendChild(typingEl);

    // Smooth scroll with RAF for better performance
    this.scheduleScroll(() => {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    });

    if (!this.isOpen) {
      this.buttonTypingIndicator.style.display = "flex";
      this.button.classList.add("has-preview");
    }
  }

  /**
   * Removes typing indicator from chat and button
   * @returns {void}
   */
  hideTyping() {
    const typingEl = document.getElementById("typing-indicator");
    if (typingEl) typingEl.remove();
    this.buttonTypingIndicator.style.display = "none";
    this.button.classList.remove("has-preview");
  }

  /**
   * Shows message preview popup near chat button when chat is closed
   * Auto-hides after PREVIEW_TIMEOUT milliseconds
   * @param {string} message - Message text to preview (truncated to 60 chars)
   * @returns {void}
   */
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
      this.previewTimeout = setTimeout(() => this.hideMessagePreview(), UniversalChatWidget.TIMINGS.PREVIEW_TIMEOUT);
    }
  }

  /**
   * Hides and removes the message preview popup
   * Clears any pending preview timeout
   * @returns {void}
   */
  hideMessagePreview() {
    const preview = document.getElementById("message-preview");
    if (preview) preview.remove();
    if (this.previewTimeout) clearTimeout(this.previewTimeout);
  }

  /**
   * Adds a formatted message to the chat interface
   * Handles markdown formatting, LaTeX rendering, code blocks, and citations
   * @param {"user"|"assistant"} type - Message sender type
   * @param {string} content - Raw message content (will be formatted)
   * @param {SourceData[]} [sources=[]] - Citation source data for assistant messages
   * @returns {void}
   */
  addMessage(type, content, sources = []) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${type}`;
    messageEl.setAttribute("role", "article");

    const formatted = this.formatMessage(content);
    const time = this.formatTime(new Date());
    const sender = type === "user" ? "You" : "Assistant";

    messageEl.setAttribute("aria-label", `Message from ${sender} at ${time}`);
    messageEl.innerHTML = `
      <div class="message-bubble">${formatted}</div>
      <div class="message-time" aria-label="sent at ${time}">${time}</div>
    `;
    this.messagesEl.appendChild(messageEl);

    // Add copy buttons to any code blocks in the message
    this.addCopyButtonsToCodeBlocks(messageEl);

    // Render LaTeX in the message
    this.renderLatex(messageEl);

    // Render citations in the message with sources
    this.renderCitations(messageEl, sources);

    // Smooth scroll with RAF for better performance
    this.scheduleScroll(() => {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    });
  }

  /**
   * Formats message content from markdown to HTML
   * Escapes HTML, then applies markdown transformations for headers, bold, italic, code blocks
   * @param {string} content - Raw markdown content
   * @returns {string} HTML-formatted message content
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
   * Formats a Date object as a localized time string (HH:MM format)
   * @param {Date} date - Date object to format
   * @returns {string} Formatted time string
   */
  formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  /**
   * Updates the visibility and count of the unread message badge on the chat button
   * @returns {void}
   */
  updateUnreadBadge() {
    if (this.unreadCount > 0) {
      this.unreadBadge.textContent = this.unreadCount;
      this.unreadBadge.style.display = "block";
    } else {
      this.unreadBadge.style.display = "none";
    }
  }

  /**
   * Clears all chat history and resets the interface to initial welcome message
   * Preserves widget state but removes all conversation data
   * @returns {void}
   */
  clearChat() {
    this.history = [];
    this.messagesEl.innerHTML = `
      <div class="message assistant">
        <div class="message-bubble">${this.options.welcomeMessage}</div>
        <div class="message-time">${this.formatTime(new Date())}</div>
      </div>
    `;

    // Add copy buttons to welcome message
    this.addCopyButtonsToCodeBlocks(this.messagesEl);

    // Render LaTeX in welcome message
    this.renderLatex(this.messagesEl);

    // Render citations in welcome message
    this.renderCitations(this.messagesEl.querySelector(".message"), []);

    this.updateUnreadBadge();
    this.saveState();
  }

  /**
   * Saves current chat state to sessionStorage for persistence across page refreshes
   * Stores conversation history, interaction status, and trace ID for API continuity
   * @returns {void}
   */
  saveState() {
    const stateToSave = {
      history: this.history,
      hasInteracted: this.hasInteracted,
      traceId: this.traceId, // Persist trace ID for conversation continuity
    };

    if (this.options.debug) {
      console.log("Client saving state with traceId:", this.traceId);
    }

    sessionStorage.setItem("universalChatState", JSON.stringify(stateToSave));
  }

  /**
   * Restores chat state from sessionStorage on widget initialization
   * Rebuilds message history in UI and restores trace ID for conversation continuity
   * @returns {void}
   */
  restoreState() {
    const saved = sessionStorage.getItem("universalChatState");
    if (saved) {
      const state = JSON.parse(saved);
      this.history = state.history || [];
      this.hasInteracted = state.hasInteracted || false;
      this.traceId = state.traceId || null; // Restore trace ID for conversation continuity

      if (this.options.debug) {
        console.log(
          "Client restored traceId from sessionStorage:",
          this.traceId,
        );
      }

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

  // Cleanup method to prevent memory leaks
  destroy() {
    // Clear all timers
    Object.values(this.debounceTimers).forEach((timer) => clearTimeout(timer));
    this.debounceTimers = {};

    // Cancel all RAF requests
    Object.values(this.rafIds).forEach((id) => cancelAnimationFrame(id));
    this.rafIds = {};

    // Clear preview timeout
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }

    // Remove focus trap
    this.removeFocusTrap();

    // Remove DOM elements
    if (this.button) this.button.remove();
    if (this.window) this.window.remove();

    // Remove styles (only if no other instances exist)
    const styleEl = document.getElementById("universal-chat-styles");
    if (styleEl) styleEl.remove();

    if (this.options.debug) {
      console.log("Chat widget destroyed and cleaned up");
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
