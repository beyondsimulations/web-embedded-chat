// Universal Chat Widget - Works with any OpenAI-compatible API

(function() {
"use strict";

// ============================================================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================================================

/**
 * @typedef {Object} ChatOptions
 * Defaults are defined in _normalizeOptions().
 * @property {string} [title] - Chat window title
 * @property {string} [welcomeMessage] - Initial greeting message
 * @property {string} [placeholder] - Input placeholder text
 * @property {string} [language] - UI language: "en" | "de" (default: "en")
 * @property {string} [headerSubtitle] - Subtitle text shown below title in header (supports markdown links)
 * @property {string} [position] - Widget position: "bottom-right" | "bottom-left" | "top-right" | "top-left"
 * @property {string} apiEndpoint - API endpoint URL for chat requests (required)
 * @property {string} [configUrl] - URL to fetch widget config from (colors, title, etc). If unreachable, widget stays hidden.
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
 * @property {string} [subtitleColor] - Subtitle text color (falls back to titleFontColor)
 * @property {number} [subtitleFontSize] - Subtitle font size in rem (0.5–0.8, default 0.65)
 * @property {string} [windowBorderColor] - Window frame border color
 * @property {string} [headerBorderColor] - Header bottom border color
 * @property {string} [assistantBubbleBorderColor] - Assistant message bubble border color
 * @property {string} [userBubbleBorderColor] - User message bubble border color
 * @property {string} [inputBorderColor] - Input area border color
 * @property {string} [codeBorderColor] - Code block border color
 * @property {string} [citationBorderColor] - Citation/reference border color
 * @property {string} [buttonIconColor] - Button icon color
 * @property {string} [scrollbarColor] - Scrollbar color
 * @property {string} [inputTextColor] - Input text color
 * @property {number} [inputAreaOpacity] - Input area opacity (0.0–1.0)
 * @property {number} [buttonShadowIntensity] - Button shadow intensity (0.0–1.0)
 * @property {number} [windowShadowIntensity] - Window/content shadow intensity (0.0–1.0)
 * @property {string} [buttonInactiveColor] - Button background when chat is closed
 * @property {string} [buttonActiveColor] - Button background when chat is open
 * @property {string} [buttonContent] - Button content when inactive (emoji or short text, max 10 chars)
 * @property {string} [buttonIconUrl] - URL or data URL for custom button icon (overrides buttonContent)
 * @property {boolean} [startOpen] - Auto-open chat on load
 * @property {number} [buttonSize] - Chat button size in pixels
 * @property {number} [windowWidth] - Chat window width in pixels
 * @property {number} [windowHeight] - Chat window height in pixels
 * @property {number} [inputShadowIntensity] - Input area shadow intensity (0.0–1.0, falls back to windowShadowIntensity)
 * @property {string|HTMLElement} [container] - CSS selector or element for inline mode mount target (default: script's parent element)
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
  REQUEST_TIMEOUT: 60000, // Default request timeout
  WELCOME_DELAY_MIN: 1000, // Min delay before welcome message
  WELCOME_DELAY_RANGE: 2000, // Random range added to welcome delay
};

/**
 * Size constants for UI elements (in pixels)
 */
const SIZES = {
  BUTTON_SIZE: 60, // Default chat button size (px)
  WINDOW_WIDTH: 450, // Default window width (px)
  WINDOW_HEIGHT: 800, // Default window height (px)
  MOBILE_BREAKPOINT: 768, // Mobile/desktop breakpoint (px)
  MOBILE_PADDING_BOTTOM: 180, // Mobile keyboard padding (px)
  SCROLLBAR_WIDTH: 6, // Scrollbar width (px)
  INPUT_MAX_HEIGHT: 100, // Max input field height (px)
  MAX_BORDER_RADIUS: 12, // Max border radius (px)
  WIDGET_MARGIN: 20, // Widget margin from viewport edge (px)
};

/**
 * Limit constants for messages, history, and content lengths
 */
const LIMITS = {
  MAX_MESSAGE_LENGTH: 2000, // Max characters per message
  MAX_HISTORY_MESSAGES: 100, // Hard limit on stored messages
  MAX_HISTORY_TOKENS: 8000, // Token budget for API context
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

/**
 * Cached date/time formatter for _formatTime (avoids creating Intl object per call)
 */
const _timeFormatter = new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * Pre-compiled regex for CSS named color validation (used by ChatValidators.validateColor)
 */
const NAMED_COLORS_RE =
  /^(transparent|currentColor|aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgr[ae]y|darkgreen|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategr[ae]y|darkturquoise|darkviolet|deeppink|deepskyblue|dimgr[ae]y|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gr[ae]y|green|greenyellow|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgr[ae]y|lightgreen|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategr[ae]y|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategr[ae]y|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen)$/i;

/**
 * Translation dictionaries for supported languages
 */
const TRANSLATIONS = {
  en: {
    title: "Course Assistant",
    welcomeMessage: "Hello! How can I help you today?",
    placeholder: "Type your question...",
    send: "Send",
    clearChat: "Clear chat",
    clearChatHistory: "Clear chat history",
    minimize: "Minimize",
    closeChat: "Close chat",
    copyCode: "Copy code",
    references: "References:",
    retry: "↻ Retry",
    retrying: "Retrying...",
    retryAriaLabel: "Retry sending message",
    senderYou: "You",
    senderAssistant: "Assistant",
    assistantTyping: "Assistant is typing",
    errorNetwork: "🔌 Connection lost. Check your internet and try again.",
    errorTimeout: "Request timed out. The server took too long to respond.",
    errorRateLimit: "Too many requests. Please wait a moment and try again.",
    errorServer: "Server error. The service is temporarily unavailable.",
    errorAuth: "Authentication error. Please check your API configuration.",
    errorClient: "❌ Invalid request. Please try again.",
    errorUnknown: "Something went wrong. Please try again.",
    errorStreamLost: "Connection lost during response.",
    charLimit: `Maximum ${LIMITS.MAX_MESSAGE_LENGTH} characters`,
    keyboardHints: "Keyboard shortcuts: Enter to send, Shift+Enter for new line, Escape to close chat",
    inputAriaLabel: "Type your message. Press Enter to send, Shift+Enter for new line",
    sendAriaLabel: "Send message (Enter)",
    openChat: "Open chat (Enter)",
    closeChat: "Close chat (Escape)",
    openChatAriaLabel: "Open chat. Press Enter to open, Escape to close",
    closeChatAriaLabel: "Close chat. Press Escape or Enter to close",
    chatConversation: "Chat conversation",
    unreadMessages: "unread",
    newMessageAnnouncement: "New message from assistant",
    messageFrom: "Message from",
    sentAt: "sent at",
    chat: "Chat",
    privateMode: "Private Mode",
    privatePlaceholder: "Type a private message...",
    privateModeOn: "Private mode is on",
    privateModeOff: "Private mode is off",
  },
  de: {
    title: "Kurs-Assistent",
    welcomeMessage: "Hallo! Wie kann ich Ihnen helfen?",
    placeholder: "Ihre Frage eingeben...",
    send: "Senden",
    clearChat: "Chat löschen",
    clearChatHistory: "Chatverlauf löschen",
    minimize: "Minimieren",
    closeChat: "Chat schließen",
    copyCode: "Code kopieren",
    references: "Referenzen:",
    retry: "↻ Erneut versuchen",
    retrying: "Wird wiederholt...",
    retryAriaLabel: "Nachricht erneut senden",
    senderYou: "Sie",
    senderAssistant: "Assistent",
    assistantTyping: "Assistent schreibt",
    errorNetwork: "🔌 Verbindung unterbrochen. Überprüfen Sie Ihre Internetverbindung.",
    errorTimeout: "Zeitüberschreitung. Der Server hat zu lange gebraucht.",
    errorRateLimit: "Zu viele Anfragen. Bitte warten Sie einen Moment.",
    errorServer: "Serverfehler. Der Dienst ist vorübergehend nicht verfügbar.",
    errorAuth: "Authentifizierungsfehler. Bitte überprüfen Sie Ihre API-Konfiguration.",
    errorClient: "❌ Ungültige Anfrage. Bitte versuchen Sie es erneut.",
    errorUnknown: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    errorStreamLost: "Verbindung während der Antwort verloren.",
    charLimit: `Maximal ${LIMITS.MAX_MESSAGE_LENGTH} Zeichen`,
    keyboardHints: "Tastenkürzel: Enter zum Senden, Umschalt+Enter für neue Zeile, Escape zum Schließen",
    inputAriaLabel: "Nachricht eingeben. Enter zum Senden, Umschalt+Enter für neue Zeile",
    sendAriaLabel: "Nachricht senden (Enter)",
    openChat: "Chat öffnen (Enter)",
    closeChat: "Chat schließen (Escape)",
    openChatAriaLabel: "Chat öffnen. Enter zum Öffnen, Escape zum Schließen",
    closeChatAriaLabel: "Chat schließen. Escape oder Enter zum Schließen",
    chatConversation: "Chat-Unterhaltung",
    unreadMessages: "ungelesen",
    newMessageAnnouncement: "Neue Nachricht vom Assistenten",
    messageFrom: "Nachricht von",
    sentAt: "gesendet um",
    chat: "Chat",
    privateMode: "Privater Modus",
    privatePlaceholder: "Private Nachricht eingeben...",
    privateModeOn: "Privater Modus ist aktiv",
    privateModeOff: "Privater Modus ist deaktiviert",
  },
};

/**
 * Looks up a translation string by key for the given language.
 * Falls back to English, then returns the key itself.
 */
function _t(lang, key) {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}

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

  clear() {
    this._events = {};
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
    if (!/^[a-zA-Z0-9\-_.:]+$/.test(model)) {
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
          if (
            sourceData.source.url &&
            typeof sourceData.source.url === "string"
          ) {
            sanitized.source.url = sourceData.source.url.substring(0, 2000);
          }
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
   * Validates a CSS color value against known safe formats.
   * Allows hex, rgb/rgba, hsl/hsla, and named CSS colors.
   * Rejects values containing CSS injection characters.
   */
  static validateColor(color) {
    if (!color || typeof color !== "string") return null;
    const c = color.trim();

    // Allow hex colors: #rgb, #rrggbb, #rrggbbaa
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)) return c;

    // Allow rgb/rgba/hsl/hsla with strict format validation
    if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)$/i.test(c)) return c;
    if (/^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*(0|1|0?\.\d+))?\s*\)$/i.test(c)) return c;

    // Use CSS.supports for named colors and other valid CSS color values
    if (typeof CSS !== "undefined" && CSS.supports && CSS.supports("color", c)) return c;

    // Fallback for environments without CSS.supports
    if (NAMED_COLORS_RE.test(c)) return c;

    console.warn(
      "Chat Widget: Color value rejected - unrecognized format:",
      c,
    );
    return null;
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
    if (!hex || !hex.startsWith("#")) {
      return ColorUtils.getColorWithOpacity(hex, opacity);
    }
    let h = hex.replace("#", "");
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    } else if (h.length === 8) {
      h = h.slice(0, 6);
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  /**
   * Creates color-mix CSS value with opacity
   */
  static getColorWithOpacity(color, opacity) {
    const transparentPercent = (1 - opacity) * 100;
    return `color-mix(in srgb, ${color}, transparent ${transparentPercent}%)`;
  }

  /**
   * Scales shadow opacity by intensity multiplier
   */
  static scaledShadow(shadow, intensity) {
    return shadow.replace(
      /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/,
      (_, r, g, b, a) =>
        `rgba(${r}, ${g}, ${b}, ${(parseFloat(a) * intensity).toFixed(3)})`,
    );
  }

  /**
   * Computes WCAG 2.1 contrast ratio between two hex colors.
   * Returns null if either color is not a valid hex format.
   */
  static contrastRatio(hex1, hex2) {
    const parse = (hex) => {
      if (!hex || !hex.startsWith('#')) return null;
      const m = hex.replace("#", "").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
      if (!m) return null;
      let h = m[1];
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      const r = parseInt(h.slice(0, 2), 16) / 255;
      const g = parseInt(h.slice(2, 4), 16) / 255;
      const b = parseInt(h.slice(4, 6), 16) / 255;
      const ch = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const c1 = parse(hex1);
    const c2 = parse(hex2);
    if (c1 == null || c2 == null) return null;
    const [a, b] = c1 > c2 ? [c1, c2] : [c2, c1];
    return (a + 0.05) / (b + 0.05);
  }

  /**
   * Warns in the console if configured foreground/background color pairs
   * do not meet WCAG AA (4.5:1 for body text). Developer-facing; does not
   * block rendering.
   */
  static warnLowContrast(options) {
    const pairs = [
      ["Title", options.titleFontColor, options.titleBackgroundColor],
      ["Assistant message", options.assistantFontColor, options.assistantColor],
      ["User message", options.userFontColor, options.userColor],
      ["Input", options.inputTextColor, options.chatBackground],
    ];
    for (const [label, fg, bg] of pairs) {
      if (!fg || !bg) continue;
      const ratio = ColorUtils.contrastRatio(fg, bg);
      if (ratio != null && ratio < 4.5) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ChatWidget] ${label} contrast ${ratio.toFixed(2)}:1 fails WCAG 2.1 AA (4.5:1 required for body text). fg=${fg} bg=${bg}`,
        );
      }
    }
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Renders simple markdown to HTML (only [text](url) links with https).
 * Escapes HTML first to prevent XSS, then converts markdown links.
 */
function _renderSimpleMarkdown(text) {
  const escaped = ChatValidators.escapeHtml(text);
  return escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
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
      sessionId: null,
      lastFailedMessage: null,
      isSending: false,
      privateMode: false,
    };
    this._listeners = new Set();
    this._options = options;
    this._storageKey = this._options._instanceId
      ? `universalChatState_${this._options._instanceId}`
      : "universalChatState";
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
      sessionId: this._state.sessionId,
      privateMode: this._state.privateMode,
    };

    if (this._options.debug) {
      console.log("Client saving state with traceId:", this._state.traceId, "sessionId:", this._state.sessionId);
    }

    sessionStorage.setItem(this._storageKey, JSON.stringify(stateToSave));
  }

  /**
   * Restores state from sessionStorage
   */
  restore() {
    const saved = sessionStorage.getItem(this._storageKey);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        this.update({
          history: state.history || [],
          hasInteracted: state.hasInteracted || false,
          traceId: state.traceId || null,
          sessionId: state.sessionId || null,
          privateMode: state.privateMode || false,
        });

        if (this._options.debug) {
          console.log(
            "Client restored traceId from sessionStorage:",
            this._state.traceId,
            "sessionId:",
            this._state.sessionId,
          );
        }

        return true;
      } catch (e) {
        console.warn(
          "Chat Widget: Failed to restore state, clearing corrupted data:",
          e.message,
        );
        sessionStorage.removeItem(this._storageKey);
        return false;
      }
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
    this.timeout = options.timeout || TIMINGS.REQUEST_TIMEOUT;
    this.lang = options.language || "en";
    this._currentController = null;
  }

  /**
   * Builds the request body for chat API calls
   */
  _buildBody(message, history, traceId, sessionId, privateMode, stream = false) {
    const body = { message, history, model: this.model, traceId };
    if (stream) body.stream = true;
    if (sessionId) body.sessionId = sessionId;
    if (privateMode) body.privateMode = true;
    return body;
  }

  /**
   * Cancels any in-flight request
   */
  cancel() {
    if (this._currentController) {
      this._currentController.abort();
      this._currentController = null;
    }
  }

  /**
   * Sends message to API and returns response
   */
  async sendMessage(message, history, traceId, sessionId, privateMode) {
    this.cancel();

    const controller = new AbortController();
    this._currentController = controller;
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    if (this.debug) {
      console.log("Client sending traceId:", traceId, "sessionId:", sessionId);
    }

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this._buildBody(message, history, traceId, sessionId, privateMode)),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        throw this._createError(data.error || "Request failed", response);
      }

      return this._extractResponseData(data);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        const abortError = new Error("Request timed out or was cancelled");
        abortError.errorInfo = {
          type: "timeout",
          message: "Request timed out. The server took too long to respond.",
        };
        throw abortError;
      }
      throw error;
    } finally {
      if (this._currentController === controller) {
        this._currentController = null;
      }
    }
  }

  /**
   * Sends message via streaming SSE and dispatches events via callbacks
   */
  async sendMessageStreaming(message, history, traceId, sessionId, privateMode, callbacks) {
    this.cancel();

    const controller = new AbortController();
    this._currentController = controller;
    // First-byte timeout: abort if no data arrives within timeout period
    let firstByteReceived = false;
    const timeoutId = setTimeout(() => {
      if (!firstByteReceived) controller.abort();
    }, this.timeout);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this._buildBody(message, history, traceId, sessionId, privateMode, true)),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let data = {};
        try { data = await response.json(); } catch (_) {}
        throw this._createError(data.error || "Request failed", response);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        firstByteReceived = true;
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete last line in buffer
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("event:")) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataStr);
              const eventName = currentEvent || "message";

              if (eventName === "delta" && parsed.content) {
                callbacks.onDelta?.(parsed.content);
              } else if (eventName === "sources" && parsed.sources) {
                callbacks.onSources?.(parsed.sources);
              } else if (eventName === "done") {
                callbacks.onDone?.(parsed);
              } else if (eventName === "error") {
                callbacks.onError?.(new Error(parsed.error || "Stream error"));
              }
            } catch (_) {
              // Skip malformed JSON lines
            }
            currentEvent = null;
          } else if (trimmed === "") {
            currentEvent = null;
          }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        const abortError = new Error("Request timed out or was cancelled");
        abortError.errorInfo = {
          type: "timeout",
          message: "Request timed out. The server took too long to respond.",
        };
        callbacks.onError?.(abortError);
        return;
      }
      callbacks.onError?.(error);
    } finally {
      if (this._currentController === controller) {
        this._currentController = null;
      }
    }
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
      sessionId: data.sessionId,
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
    const lang = this.lang;
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return { type: "network", message: _t(lang, "errorNetwork") };
    }

    if (error.name === "AbortError") {
      return { type: "timeout", message: _t(lang, "errorTimeout") };
    }

    if (response) {
      if (response.status === 429) {
        return { type: "ratelimit", message: _t(lang, "errorRateLimit") };
      }
      if (response.status >= 500) {
        return { type: "server", message: _t(lang, "errorServer") };
      }
      if (response.status === 401 || response.status === 403) {
        return { type: "auth", message: _t(lang, "errorAuth") };
      }
      if (response.status >= 400) {
        return { type: "client", message: _t(lang, "errorClient") };
      }
    }

    return { type: "unknown", message: _t(lang, "errorUnknown") };
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
    this._rendererLoaded = null;
    this._md = null;
  }

  /**
   * Formats message from markdown to HTML
   */
  formatMessage(content) {
    if (this._md) {
      // LLMs sometimes use $\n...\n$ for display math — normalize to $$
      content = content.replace(/(?<!\$)\$\n([\s\S]+?)\n\$(?!\$)/g, (_, inner) => `$$\n${inner}\n$$`);
      // LLMs often output $ f(x) $ with spaces — texmath requires no spaces after/before $.
      // Convert to \(...\) only when content contains LaTeX markers to avoid currency false-matches.
      content = content.replace(/(?<!\$)\$ +((?:[^$]*?[\\^_{}])[^$]*?) +\$(?!\$)/g, (_, inner) => `\\(${inner.trim()}\\)`);
      try {
        return this._md.render(content);
      } catch (e) {
        console.warn("Chat Widget: Math render failed, falling back to plain markdown", e);
      }
    }
    // Fallback: plain markdown without math, or basic HTML escaping
    if (this._plainMd) return this._plainMd.render(content);
    return ChatValidators.escapeHtml(content).replace(/\n/g, "<br>");
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
      copyBtn.setAttribute("aria-label", _t(this.options.language, "copyCode"));

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
   * Loads markdown-it + KaTeX + texmath for integrated markdown + math rendering
   */
  _loadRenderer() {
    if (this._rendererLoaded) return this._rendererLoaded;

    const loadScript = (src, check) => new Promise((resolve) => {
      if (check && check()) { resolve(); return; }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => {
        console.warn(`Chat Widget: Failed to load ${src}`);
        resolve();
      };
      document.head.appendChild(s);
    });

    this._rendererLoaded = loadScript(
      "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js",
      () => window.katex
    )
      .then(() => loadScript(
        "https://cdn.jsdelivr.net/npm/markdown-it/dist/markdown-it.min.js",
        () => window.markdownit
      ))
      .then(() => loadScript(
        "https://cdn.jsdelivr.net/npm/markdown-it-texmath/texmath.min.js",
        () => window.texmath
      ))
      .then(() => {
        // Always create a plain markdown fallback (no math) for graceful degradation
        if (window.markdownit) {
          this._plainMd = window.markdownit({ breaks: true });
        }
        if (window.markdownit && window.texmath && window.katex) {
          this._md = window.markdownit({ breaks: true })
            .use(window.texmath, {
              engine: window.katex,
              delimiters: ["dollars", "brackets", "beg_end"],
              katexOptions: { throwOnError: false, errorColor: this.options.stampColor },
            });
        } else if (window.markdownit) {
          this._md = window.markdownit({ breaks: true });
        }
      });

    return this._rendererLoaded;
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
          const docContent = Array.isArray(document)
            ? document[citationNum - 1]
            : document[docKey] || document[citationNum - 1];

          if (docContent && typeof docContent === "string") {
            const snippet = String(docContent)
              .substring(0, LIMITS.SNIPPET_LENGTH)
              .replace(/[#*-]/g, "")
              .replace(/\s+/g, " ")
              .trim();

            citations[citationNum] = {
              sourceName: source.name || "Reference",
              sourceUrl: source.url || "",
              description: source.description || "",
              metadata: metadata?.[docKey] || null,
              snippet: snippet,
            };
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
    // Group citations by source document name
    const groups = {};
    const sortedNums = Object.keys(citations).sort(
      (a, b) => parseInt(a) - parseInt(b),
    );

    sortedNums.forEach((num) => {
      const cite = citations[num];
      const key = cite.sourceName;
      if (!groups[key]) {
        groups[key] = { sourceName: cite.sourceName, sourceUrl: cite.sourceUrl, description: cite.description, entries: [] };
      }
      groups[key].entries.push({ num, metadata: cite.metadata, snippet: cite.snippet });
    });

    let referencesHtml = `<div class="references-section"><h4>${_t(this.options.language, "references")}</h4>`;

    Object.values(groups).forEach((group) => {
      // Source header
      let header = group.sourceUrl
        ? `<a href="${ChatValidators.escapeHtml(group.sourceUrl)}" target="_blank" rel="noopener"><strong>${ChatValidators.escapeHtml(group.sourceName)}</strong></a>`
        : `<strong>${ChatValidators.escapeHtml(group.sourceName)}</strong>`;
      if (group.description) {
        header += ` - ${ChatValidators.escapeHtml(group.description)}`;
      }

      referencesHtml += `<div class="reference-group">${header}`;
      referencesHtml += '<ol class="references-list">';

      group.entries.forEach((entry) => {
        let entryHtml = "";
        if (entry.metadata) {
          entryHtml += this._formatMetadata(entry.metadata);
        }
        if (entry.snippet) {
          entryHtml += `<em>${ChatValidators.escapeHtml(entry.snippet)}...</em>`;
        }
        referencesHtml += `<li value="${entry.num}" id="ref-${entry.num}" class="reference-item">${entryHtml}</li>`;
      });

      referencesHtml += "</ol></div>";
    });

    referencesHtml += "</div>";
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
      ${this.generateButton()}
      ${this.generateWindow()}
      ${this.generateMessages()}
      ${this.generateInput()}
      ${this.generateMarkdown()}
      ${this.generateCitations()}
      ${this.generateMobile()}
      ${this.generateIframeMode()}
      ${this.generateAnimations()}
      ${this.generateAccessibility()}
    `;
  }

  generateVariables() {
    const o = this.options;
    const id = o._instanceId || "chat-0";
    return `
      #${id}, #${id}-btn {
        /* Color variables */
        --chat-title-bg: ${o.titleBackgroundColor};
        --chat-title-fg: ${o.titleFontColor};
        --chat-assistant-color: ${o.assistantColor};
        --chat-assistant-fg: ${o.assistantFontColor};
        --chat-user-color: ${o.userColor};
        --chat-user-fg: ${o.userFontColor};
        --chat-background: ${o.chatBackground};
        --chat-stamp-color: ${o.stampColor};
        --chat-code-bg: ${o.codeBackgroundColor};
        --chat-code-fg: ${o.codeTextColor};
        --chat-subtitle-color: ${o.subtitleColor || o.titleFontColor};
        --chat-subtitle-size: ${o.subtitleFontSize}rem;
        --chat-border-window: ${o.windowBorderColor};
        --chat-border-header: ${o.headerBorderColor};
        --chat-border-assistant: ${o.assistantBubbleBorderColor};
        --chat-border-user: ${o.userBubbleBorderColor};
        --chat-border-input: ${o.inputBorderColor};
        --chat-border-code: ${o.codeBorderColor};
        --chat-border-citation: ${o.citationBorderColor};
        --chat-button-icon: ${o.buttonIconColor};
        --chat-scrollbar: ${o.scrollbarColor};
        --chat-input-fg: ${o.inputTextColor};

        /* Button state colors */
        --chat-button-inactive-bg: ${o.buttonInactiveColor || "var(--chat-assistant-color)"};
        --chat-button-active-bg: ${o.buttonActiveColor || "var(--chat-user-color)"};

        /* Computed backgrounds (hex + opacity → rgba) */
        --chat-code-bg-alpha: ${ColorUtils.hexToRgba(o.codeBackgroundColor, o.codeOpacity)};
        --chat-input-area-bg: ${ColorUtils.hexToRgba(o.chatBackground, o.inputAreaOpacity)};
        --chat-error-bg: ${ColorUtils.hexToRgba(o.stampColor, 0.1)};
        --chat-selection-bg: ${ColorUtils.hexToRgba(o.userColor, 0.3)};
        --chat-user-bubble-bg: ${ColorUtils.getColorWithOpacity("var(--chat-user-color)", o.userMessageOpacity)};
        --chat-assistant-bubble-bg: ${ColorUtils.getColorWithOpacity("var(--chat-assistant-color)", o.assistantMessageOpacity)};

        /* Shadow variables (scaled by intensity) */
        --btn-shadow: ${ColorUtils.scaledShadow("0 4px 12px rgba(0, 0, 0, 0.15)", o.buttonShadowIntensity)};
        --btn-shadow-hover: ${ColorUtils.scaledShadow("0 6px 16px rgba(0, 0, 0, 0.3)", o.buttonShadowIntensity)};
        --btn-shadow-badge: ${ColorUtils.scaledShadow("0 2px 4px rgba(0, 0, 0, 0.2)", o.buttonShadowIntensity)};
        --btn-shadow-typing: ${ColorUtils.scaledShadow("0 2px 8px rgba(0, 0, 0, 0.15)", o.buttonShadowIntensity)};
        --btn-shadow-preview: ${ColorUtils.scaledShadow("0 4px 12px rgba(0, 0, 0, 0.1)", o.buttonShadowIntensity)};
        --win-shadow: ${ColorUtils.scaledShadow("0 10px 40px rgba(0, 0, 0, 0.15)", o.windowShadowIntensity)};
        --win-shadow-input: ${ColorUtils.scaledShadow("0 4px 12px rgba(0, 0, 0, 0.15)", o.inputShadowIntensity != null ? o.inputShadowIntensity : o.windowShadowIntensity)};
        --win-shadow-hover: ${ColorUtils.scaledShadow("0 2px 8px rgba(0, 0, 0, 0.3)", o.windowShadowIntensity)};

        /* Size variables */
        --chat-radius: ${o.borderRadius}px;
        --button-size: ${o.buttonSize}px;
        --window-width: ${o.windowWidth}px;
        --window-height: ${o.windowHeight}px;
        --scrollbar-width: ${SIZES.SCROLLBAR_WIDTH}px;
        --input-max-height: ${SIZES.INPUT_MAX_HEIGHT}px;
      }
    `;
  }

  injectExternalAssets() {
    // Inject <link> elements for external stylesheets
    const links = [
      { href: "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" },
    ];
    links.forEach(({ href }) => {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
    });
  }

  generateButton() {
    const position = this.options.position;
    return `
      .universal-chat-button {
        position: fixed;
        ${position.includes("right") ? `right: ${SIZES.WIDGET_MARGIN}px` : `left: ${SIZES.WIDGET_MARGIN}px`};
        ${position.includes("bottom") ? `bottom: ${SIZES.WIDGET_MARGIN}px` : `top: ${SIZES.WIDGET_MARGIN}px`};
        width: var(--button-size);
        height: var(--button-size);
        border-radius: var(--chat-radius);
        background: var(--chat-button-inactive-bg);
        box-shadow: var(--btn-shadow);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        z-index: 9998;
        border: none;
        color: var(--chat-button-icon);
        font-family: inherit;
        font-size: 28px;
        line-height: 1;
      }

      .universal-chat-button:hover,
      .universal-chat-button:focus {
        background: var(--chat-stamp-color);
        transform: scale(1.1);
        box-shadow: var(--btn-shadow-hover);
      }

      .universal-chat-button.chat-open {
        background: var(--chat-button-active-bg);
      }

      .universal-chat-button.chat-open:hover,
      .universal-chat-button.chat-open:focus {
        background: var(--chat-stamp-color);
        transform: scale(1.1);
        box-shadow: var(--btn-shadow-hover);
      }

      .chat-unread-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: var(--chat-assistant-color);
        color: var(--chat-stamp-color);
        border-radius: var(--chat-radius);
        padding: 2px 6px;
        font-size: 12px;
        font-weight: bold;
        min-width: 20px;
        text-align: center;
        box-shadow: var(--btn-shadow-badge);
      }

      .button-typing-indicator {
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--chat-background);
        padding: 4px 8px;
        border-radius: var(--chat-radius);
        box-shadow: var(--btn-shadow-typing);
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
        border-radius: var(--chat-radius);
        box-shadow: var(--btn-shadow-preview);
        max-width: 250px;
        font-size: 14px;
        color: var(--chat-assistant-fg);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        animation: slideIn 0.3s ease;
      }

      .universal-chat-button.button-text-content {
        font-size: 14px;
        line-height: 1.2;
        padding: 4px;
        word-break: break-word;
        text-align: center;
      }
    `;
  }

  generateWindow() {
    const position = this.options.position;
    return `
      .universal-chat-window {
        position: fixed;
        ${position.includes("right") ? `right: ${SIZES.WIDGET_MARGIN}px` : `left: ${SIZES.WIDGET_MARGIN}px`};
        ${position.includes("bottom") ? `bottom: calc(var(--button-size) + ${SIZES.WIDGET_MARGIN * 2}px)` : `top: calc(var(--button-size) + ${SIZES.WIDGET_MARGIN * 2}px)`};
        width: var(--window-width);
        height: var(--window-height);
        max-height: calc(100vh - var(--button-size) - 60px);
        background: var(--chat-background);
        border-radius: var(--chat-radius);
        overflow: hidden;
        border: none;
        outline: 1px solid var(--chat-border-window);
        box-shadow: var(--win-shadow);
        display: flex;
        flex-direction: column;
        z-index: 9999;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
        font-family: inherit;
      }

      .universal-chat-window.chat-ready {
        transition: opacity 0.3s ease, transform 0.3s ease, pointer-events 0s;
      }

      .universal-chat-window.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .chat-header {
        background: var(--chat-title-bg);
        color: var(--chat-title-fg);
        padding: 0.5rem 1.25rem;
        border-bottom: 1px solid var(--chat-border-header);
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

      .chat-header-subtitle {
        margin: 0;
        font-size: var(--chat-subtitle-size, 0.65rem);
        font-weight: 400;
        color: var(--chat-subtitle-color, var(--chat-title-fg));
        opacity: 0.75;
        line-height: 1.3;
      }
      .chat-header-subtitle a {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .chat-header-subtitle a:hover {
        opacity: 1;
      }
      .chat-header-subtitle a:focus-visible {
        opacity: 1;
        outline: 2px solid var(--chat-stamp-color);
        outline-offset: 2px;
        border-radius: 2px;
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
        background: var(--chat-code-bg-alpha);
        margin: 0 1rem;
        border-radius: var(--chat-radius);
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
        border-radius: var(--chat-radius);
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
        border-radius: var(--chat-radius);
        word-wrap: break-word;
      }

      .message-bubble img {
        max-width: 100%;
        height: auto;
        border-radius: calc(var(--chat-radius) / 2);
        margin: 0.4em 0;
      }

      .message-bubble p {
        margin: 0.4em 0;
      }

      .message-bubble p:first-child { margin-top: 0; }
      .message-bubble p:last-child { margin-bottom: 0; }

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
        background: var(--chat-user-bubble-bg);
        border: 1px solid var(--chat-border-user);
        color: var(--chat-user-fg);
        border-radius: var(--chat-radius);
        text-align: left;
      }

      .message.assistant .message-bubble {
        background: var(--chat-assistant-bubble-bg);
        border: 1px solid var(--chat-border-assistant);
        border-radius: var(--chat-radius);
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
        background: var(--chat-assistant-bubble-bg);
        border: 1px solid var(--chat-border-assistant);
        border-radius: var(--chat-radius);
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

      .stream-error-notice {
        margin-top: 0.5rem;
        padding: 0.4rem 0.6rem;
        font-size: 0.8em;
        color: #d32f2f;
        border-top: 1px solid rgba(211,47,47,0.3);
        font-style: italic;
      }

      .message.error {
        text-align: center;
        margin: 1rem 0;
      }

      .message.error .message-bubble {
        background: var(--chat-error-bg);
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
        border: 1px solid var(--chat-border-input);
        border-radius: var(--chat-radius);
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
        box-shadow: var(--win-shadow-hover);
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
        background: var(--chat-input-area-bg);
        border-radius: var(--chat-radius);
        box-shadow: var(--win-shadow-input);
        z-index: 10;
      }

      .chat-input-container {
        display: flex;
        border: 1px solid var(--chat-border-input);
        border-radius: var(--chat-radius);
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
        box-sizing: border-box;
      }

      .chat-input:focus {
        outline: none !important;
        caret-color: var(--chat-stamp-color);
      }

      /* Only show the input container ring during keyboard navigation.
         The .keyboard-nav class is toggled by JS (Tab adds it, mousedown removes it)
         so programmatic focus on open() and click focus don't trigger the ring. */
      .keyboard-nav .chat-input-container:focus-within {
        border-color: var(--chat-stamp-color) !important;
        box-shadow: 0 0 0 2px var(--chat-stamp-color) !important;
      }

      .chat-send-btn {
        padding: 0.75rem 1rem;
        background: var(--chat-user-color);
        color: var(--chat-user-fg);
        border: none;
        border-left: 1px solid var(--chat-border-input);
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
        box-shadow: var(--win-shadow-hover);
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
        background: var(--chat-code-bg-alpha);
        padding: 0.125rem 0.25rem;
        border-radius: var(--chat-radius);
        font-family: 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
        font-size: 0.9em;
        color: var(--chat-code-fg);
        word-break: break-all;
        white-space: pre-wrap;
      }

      .message.user .message-bubble code {
        background: var(--chat-code-bg-alpha);
        color: var(--chat-code-fg);
      }

      .message-bubble pre {
        background: var(--chat-code-bg-alpha);
        color: var(--chat-code-fg);
        padding: 0.5rem;
        margin-top: 0.1rem;
        border-radius: var(--chat-radius);
        overflow-x: auto;
        overflow-y: hidden;
        max-width: 100%;
        white-space: pre-wrap;
        word-break: break-word;
        position: relative;
        font-family: 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
        border: 1px solid var(--chat-border-code);
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
        background: var(--chat-border-code);
        color: var(--chat-title-fg);
        border: none;
        border-radius: var(--chat-radius);
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        cursor: pointer;
        opacity: 0.4;
        transition: opacity 0.2s ease;
        z-index: 1;
      }

      .code-copy-btn:hover,
      .code-copy-btn:focus-visible {
        background: var(--chat-stamp-color);
        transform: scale(1.05);
        opacity: 1;
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
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
      }

      .katex-error {
        color: var(--chat-stamp-color);
        border: 1px solid var(--chat-stamp-color);
        padding: 0.25rem;
        border-radius: var(--chat-radius);
        background: var(--chat-code-bg-alpha);
      }

      .message-bubble ul,
      .message-bubble ol {
        margin: 0.5rem 0;
        padding-left: 1.5rem;
      }

      .message-bubble li {
        margin-bottom: 0.25rem;
      }

      .message-bubble li > ul,
      .message-bubble li > ol {
        margin: 0.15rem 0;
      }

      .message-bubble a {
        color: var(--chat-code-fg);
        text-decoration: underline;
        word-break: break-all;
      }

      .message-bubble a:hover,
      .message-bubble a:focus {
        color: var(--chat-stamp-color);
      }
      .message-bubble a:focus-visible {
        outline: 2px solid var(--chat-stamp-color);
        outline-offset: 1px;
        border-radius: 2px;
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
        border-radius: var(--chat-radius);
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
        border-top: 1px solid var(--chat-border-citation);
      }

      .references-section h4 {
        margin: 0 0 1rem 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--chat-assistant-fg);
      }

      .reference-group {
        margin-bottom: 0.75rem;
        font-size: 0.8em;
      }

      .reference-group:last-child {
        margin-bottom: 0;
      }

      .references-list {
        margin: 0.25rem 0 0;
        padding-left: 1rem;
        font-size: 0.9em;
      }

      .reference-item {
        margin-bottom: 0.5rem;
        color: var(--chat-assistant-fg);
        transition: background-color 0.3s ease;
        text-align: justify;
      }

      .reference-item.highlighted {
        background: var(--chat-code-bg-alpha);
        padding: 0.5rem;
        border-radius: var(--chat-radius);
        border-left: 2px solid var(--chat-user-color);
      }
    `;
  }

  generateMobile() {
    return `
      @media (max-width: ${SIZES.MOBILE_BREAKPOINT}px) {
        .universal-chat-window:not(.inline-mode) {
          width: 100vw !important;
          height: 100vh !important;
          height: 100lvh !important;
          max-height: none !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          outline: none !important;
          transform: none !important;
          background: var(--chat-title-bg) !important;
        }

        .universal-chat-button.chat-open {
          display: none !important;
        }

        .universal-chat-window:not(.inline-mode):not(.open) {
          display: none !important;
        }

        .universal-chat-window:not(.iframe-mode) .chat-header {
          padding-top: calc(0.5rem + env(safe-area-inset-top, 0px));
        }

        .chat-messages {
          padding-bottom: calc(100vh - 100dvh + var(--input-max-height) + env(safe-area-inset-bottom, 0px) + env(keyboard-inset-height, 0px));
        }

        .chat-input-area {
          bottom: calc(100vh - 100dvh + env(safe-area-inset-bottom, 0px) + env(keyboard-inset-height, 0px) + 4px);
        }

        .chat-input-container {
          border-radius: var(--chat-radius);
          border: 1px solid var(--chat-border-input);
        }

        .chat-input {
          font-size: 16px !important;
        }

        .katex {
          font-size: 1em;
        }
      }

      @media (hover: none) and (pointer: coarse) {
        .universal-chat-button:active {
          background: var(--chat-stamp-color);
          transform: scale(1.1);
          box-shadow: var(--btn-shadow-hover);
        }

        .universal-chat-button.chat-open:active {
          background: var(--chat-stamp-color);
          transform: scale(1.1);
          box-shadow: var(--btn-shadow-hover);
        }

        .chat-header-btn:active {
          color: var(--chat-stamp-color) !important;
          transform: scale(1.1);
          opacity: 1 !important;
        }

        .chat-send-btn:active:not(:disabled):not([aria-disabled="true"]) {
          background: var(--chat-stamp-color) !important;
          transform: scale(1.05);
          box-shadow: var(--win-shadow-hover);
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
          box-shadow: var(--win-shadow-hover);
        }
      }
    `;
  }

  generateIframeMode() {
    return `
      .universal-chat-window.iframe-mode {
        position: relative !important;
        width: 100% !important;
        height: 100vh !important;
        height: 100lvh !important;
        max-height: none !important;
        top: auto !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        outline: none !important;
        opacity: 1 !important;
        transform: none !important;
        pointer-events: auto !important;
      }

      .universal-chat-window.iframe-mode .chat-header {
        padding-top: calc(0.5rem + env(safe-area-inset-top, 0px));
      }

      .universal-chat-window.inline-mode {
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
        max-height: none !important;
        top: auto !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        opacity: 1 !important;
        transform: none !important;
        pointer-events: auto !important;
      }

      @media (max-width: ${SIZES.MOBILE_BREAKPOINT}px) {
        .universal-chat-window.iframe-mode {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
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

      @media (prefers-reduced-motion: reduce) {
        .message,
        .universal-chat-window,
        .universal-chat-button,
        .button-typing-indicator,
        .button-message-preview {
          animation: none !important;
          transition: none !important;
        }
        .typing-indicator span,
        .button-typing-indicator span {
          animation: none !important;
          opacity: 0.6;
        }
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
        background: var(--chat-selection-bg);
        color: var(--chat-assistant-fg);
      }

      .universal-chat-window ::-moz-selection {
        background: var(--chat-selection-bg);
        color: var(--chat-assistant-fg);
      }

      /* ── Visible focus indicators (WCAG 2.4.7 Focus Visible, AA) ──────────
         Hover and focus styles were previously combined with \`outline: none\`,
         which meant keyboard-only users tabbing without hovering saw no visible
         focus state. These rules add an explicit box-shadow ring that is
         independent of the hover state. */
      .universal-chat-window :focus-visible,
      .universal-chat-button:focus-visible {
        outline: 2px solid var(--chat-stamp-color);
        outline-offset: 2px;
        border-radius: var(--chat-radius);
      }
      .chat-header-btn:focus-visible,
      .chat-send-btn:focus-visible,
      .retry-btn:focus-visible,
      .code-copy-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px var(--chat-background),
                    0 0 0 4px var(--chat-stamp-color);
      }
      /* Input focus ring is handled by .keyboard-nav .chat-input-container:focus-within
         in generateInput() — no separate rule needed here. Browsers apply :focus-visible
         to textareas even on click, which would show an unwanted ring on open. */
      .citation-link:focus-visible {
        outline: 2px solid var(--chat-stamp-color);
        outline-offset: 1px;
        text-decoration: underline;
      }
      /* Browsers without :focus-visible fall back to a plain focus ring */
      @supports not selector(:focus-visible) {
        .universal-chat-window :focus,
        .universal-chat-button:focus {
          outline: 2px solid var(--chat-stamp-color);
          outline-offset: 2px;
        }
      }

      /* Copy-code button: reveal on keyboard focus-within, not only hover (D5). */
      .message-bubble pre:focus-within .code-copy-btn,
      .code-copy-btn:focus-visible {
        opacity: 1 !important;
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

    // If focus is outside the chat window, only pull it in when nothing else is
    // meaningfully focused (e.g. after opening the widget via mouse click on mobile).
    // Never steal focus from other interactive elements on the host page.
    if (!this.window.contains(document.activeElement)) {
      if (document.activeElement && document.activeElement !== document.body) return;
      e.preventDefault();
      const focusable = this.getFocusableElements();
      if (focusable.length) {
        (e.shiftKey ? focusable[focusable.length - 1] : focusable[0]).focus();
      }
      return;
    }

    e.preventDefault();

    const focusableElements = this.getFocusableElements();
    if (!focusableElements || focusableElements.length === 0) return;

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
   * Sets up focus trap. Idempotent: calling setup() while a handler is already
   * installed is a no-op, so rapid open/close cycles don't stack listeners.
   */
  setup() {
    if (this.focusTrapHandler) return;
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
    this._id = options._instanceId || "chat-0";
  }

  /**
   * Initializes UI
   */
  init() {
    this._injectStyles();
    this._createWidget();
    this._bindEvents();
    this.accessibilityManager = new AccessibilityManager(
      this.elements.window,
      this.options,
    );
    // In iframe/inline mode the widget is always open but open() is never
    // called, so we need to activate the focus trap here directly.
    const mode = this.options.mode;
    if (mode === "iframe" || mode === "inline") {
      this.accessibilityManager.setup();
    }
  }

  /**
   * Opens chat window
   */
  open() {
    this.elements.window.classList.add("open");
    this.elements.button.classList.add("chat-open");
    this.elements.button.classList.remove("button-text-content");
    this.elements.button.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
    this.elements.button.setAttribute(
      "aria-label",
      _t(this.options.language, "closeChatAriaLabel"),
    );
    this.elements.button.setAttribute("aria-expanded", "true");
    this.elements.button.setAttribute("tabindex", "-1");
    this.elements.button.title = _t(this.options.language, "closeChat");
    this.elements.window.setAttribute("aria-modal", "true");

    // Prevent body scroll on mobile and fill safe area (notch, home bar) with title bar color
    if (window.innerWidth <= SIZES.MOBILE_BREAKPOINT && this.options.mode !== 'iframe') {
      if (!this._themeMetaEl) {
        this._themeMetaEl = document.querySelector('meta[name="theme-color"]');
      }
      let viewportMeta = document.querySelector('meta[name="viewport"]');
      const hadViewportMeta = !!viewportMeta;
      const originalViewportContent = viewportMeta ? viewportMeta.content : null;

      // Ensure viewport-fit=cover for env(safe-area-inset-*) to work
      if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.name = 'viewport';
        viewportMeta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
        document.head.appendChild(viewportMeta);
      } else if (!/viewport-fit\s*=\s*cover/.test(viewportMeta.content)) {
        if (/viewport-fit\s*=/.test(viewportMeta.content)) {
          viewportMeta.content = viewportMeta.content.replace(/viewport-fit\s*=\s*[^,\s]+/, 'viewport-fit=cover');
        } else {
          viewportMeta.content += ', viewport-fit=cover';
        }
      }

      this._savedBodyStyles = {
        htmlOverflow: document.documentElement.style.overflow,
        bodyOverflow: document.body.style.overflow,
        htmlBg: document.documentElement.style.background,
        bodyBg: document.body.style.background,
        themeColor: this._themeMetaEl ? this._themeMetaEl.content : null,
        viewportMeta: viewportMeta,
        hadViewportMeta: hadViewportMeta,
        viewportContent: originalViewportContent,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      };
      window.scrollTo(0, 0);
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      this._applyDocumentChrome(this.options.titleBackgroundColor);

      // Hide all page content — iOS 26 Liquid Glass samples DOM content through
      // fixed elements for toolbar tinting, so backdrop alone is not enough
      this._hiddenSiblings = [];
      for (const child of document.body.children) {
        if (child !== this.elements.window && child !== this.elements.button) {
          this._hiddenSiblings.push({ el: child, display: child.style.display });
          child.style.display = 'none';
        }
      }
    }

    this.hideMessagePreview();
    this.hideButtonTyping();

    // Skip auto-focus on mobile — avoids iOS Safari scroll-to-input issues
    if (window.innerWidth > SIZES.MOBILE_BREAKPOINT) {
      setTimeout(() => {
        this.elements.input.focus();
      }, TIMINGS.FOCUS_DELAY);
    }

    this.accessibilityManager.setup();
  }

  /**
   * Closes chat window
   */
  close() {
    // Restore mobile state BEFORE hiding the chat window — Safari 26 Liquid Glass
    // samples toolbar tint immediately, so the page must be fully restored first
    if (this._inputArea) this._inputArea.style.bottom = '';
    this.elements.messages.style.paddingBottom = '';
    if (this._savedBodyStyles) {
      if (this._hiddenSiblings) {
        for (const { el, display } of this._hiddenSiblings) {
          el.style.display = display;
        }
        this._hiddenSiblings = null;
      }
      document.documentElement.style.overflow = this._savedBodyStyles.htmlOverflow;
      document.body.style.overflow = this._savedBodyStyles.bodyOverflow;
      document.documentElement.style.background = this._savedBodyStyles.htmlBg;
      document.body.style.background = this._savedBodyStyles.bodyBg;
      if (this._savedBodyStyles.themeColor !== null) {
        this._setThemeColor(this._savedBodyStyles.themeColor);
      } else if (this._themeMetaEl) {
        this._themeMetaEl.remove();
        this._themeMetaEl = null;
      }
      const viewportMeta = this._savedBodyStyles.viewportMeta;
      if (viewportMeta) {
        if (!this._savedBodyStyles.hadViewportMeta) {
          viewportMeta.remove();
        } else if (this._savedBodyStyles.viewportContent !== null) {
          viewportMeta.content = this._savedBodyStyles.viewportContent;
        }
      }
      window.scrollTo(this._savedBodyStyles.scrollX, this._savedBodyStyles.scrollY);
      this._savedBodyStyles = null;
    }
    this.elements.window.classList.remove("open");
    this.elements.button.classList.remove("chat-open");

    if (this.options.buttonIconUrl) {
      this._setButtonIcon();
    } else {
      this.elements.button.textContent = this.options.buttonContent;
      if (this._isTextContent) {
        this.elements.button.classList.add("button-text-content");
      }
    }
    this.elements.button.setAttribute(
      "aria-label",
      _t(this.options.language, "openChatAriaLabel"),
    );
    this.elements.button.setAttribute("aria-expanded", "false");
    this.elements.button.setAttribute("tabindex", "0");
    this.elements.button.title = _t(this.options.language, "openChat");
    this.elements.window.setAttribute("aria-modal", "false");

    this.accessibilityManager.remove();
    this.elements.button.focus();
  }

  /**
   * Sets button content to the custom icon image
   */
  _setButtonIcon() {
    const img = document.createElement("img");
    img.src = this.options.buttonIconUrl;
    img.alt = _t(this.options.language, "chat");
    img.style.cssText = "width: 60%; height: 60%; object-fit: contain; pointer-events: none;";
    this.elements.button.textContent = "";
    this.elements.button.appendChild(img);
  }

  /**
   * Adds message to chat
   */
  addMessage(type, content, time) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${type}`;
    messageEl.setAttribute("role", "article");
    const lang = this.options.language;
    const sender = type === "user" ? _t(lang, "senderYou") : _t(lang, "senderAssistant");
    messageEl.setAttribute("aria-label", `${_t(lang, "messageFrom")} ${sender} ${_t(lang, "sentAt")} ${time}`);
    messageEl.innerHTML = `
      <div class="message-bubble">${content}</div>
      <div class="message-time" aria-hidden="true">${time}</div>
    `;
    this.elements.messages.appendChild(messageEl);
    this._scrollToBottom();
    return messageEl;
  }

  /**
   * Creates a streaming assistant message bubble (empty, for in-place updates)
   */
  addStreamingMessage(time) {
    const messageEl = document.createElement("div");
    messageEl.className = "message assistant";
    messageEl.setAttribute("role", "article");
    const lang = this.options.language;
    const sender = _t(lang, "senderAssistant");
    messageEl.setAttribute("aria-label", `${_t(lang, "messageFrom")} ${sender} ${_t(lang, "sentAt")} ${time}`);
    // Build bubble via DOM API — no raw HTML injection
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    const timeDiv = document.createElement("div");
    timeDiv.className = "message-time";
    timeDiv.setAttribute("aria-hidden", "true");
    timeDiv.textContent = time;
    messageEl.appendChild(bubble);
    messageEl.appendChild(timeDiv);
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
    typingEl.id = `typing-indicator-${this._id}`;
    typingEl.setAttribute("role", "status");
    typingEl.setAttribute("aria-live", "polite");
    typingEl.setAttribute("aria-label", _t(this.options.language, "assistantTyping"));
    typingEl.innerHTML =
      '<div class="typing-indicator" aria-hidden="true"><span></span><span></span><span></span></div>';
    this.elements.messages.appendChild(typingEl);
    this._scrollToBottom();
  }

  /**
   * Hides typing indicator
   */
  hideTyping() {
    const typingEl = document.getElementById(`typing-indicator-${this._id}`);
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
      preview.id = `message-preview-${this._id}`;
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
    const preview = document.getElementById(`message-preview-${this._id}`);
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
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    const msgSpan = document.createElement("span");
    msgSpan.textContent = message;
    bubble.appendChild(msgSpan);
    bubble.appendChild(document.createElement("br"));
    const retryBtn = document.createElement("button");
    retryBtn.className = "retry-btn";
    retryBtn.setAttribute("aria-label", _t(this.options.language, "retryAriaLabel"));
    retryBtn.textContent = _t(this.options.language, "retry");
    bubble.appendChild(retryBtn);
    errorEl.appendChild(bubble);
    this.elements.messages.appendChild(errorEl);
    this._scrollToBottom();

    retryBtn.addEventListener("click", async () => {
      retryBtn.disabled = true;
      retryBtn.textContent = _t(this.options.language, "retrying");
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
   * Updates unread badge. Also updates the chat button's aria-label to
   * include the unread count, and writes to the widget's live region so
   * screen reader users are notified of new messages while the chat is closed.
   */
  updateUnreadBadge(count) {
    if (count > 0) {
      this.elements.unreadBadge.textContent = count;
      this.elements.unreadBadge.style.display = "block";
    } else {
      this.elements.unreadBadge.style.display = "none";
    }

    // Dynamic aria-label reflects unread count ("Open chat, 2 unread messages")
    if (this.elements.button && !this.elements.button.classList.contains("chat-open")) {
      const base = _t(this.options.language, "openChatAriaLabel");
      const label = count > 0 ? `${base} (${count} ${_t(this.options.language, "unreadMessages") || "unread"})` : base;
      this.elements.button.setAttribute("aria-label", label);
    }

    // Announce new messages to assistive tech via the widget's live region.
    // Only announce when count increases to avoid repeat announcements on re-render.
    if (count > 0 && count !== this._lastAnnouncedUnread && this.elements.srLive) {
      this.elements.srLive.textContent = "";
      setTimeout(() => {
        if (this.elements.srLive) {
          this.elements.srLive.textContent = _t(this.options.language, "newMessageAnnouncement") || "New message from assistant";
        }
      }, 50);
    }
    this._lastAnnouncedUnread = count;
  }

  /**
   * Clears input field
   */
  clearInput() {
    this.elements.input.value = "";
    this._autoResizeInput();
    this._syncInputPadding();
    this.elements.sendBtn.setAttribute("aria-disabled", "true");
    this.elements.sendBtn.setAttribute("tabindex", "-1");
  }

  /**
   * Re-runs the viewport handler after textarea shrinks on send to prevent a layout jump.
   */
  _syncInputPadding() {
    if (this._viewportHandler) this._viewportHandler();
  }

  /**
   * Enables or disables the input area during API calls
   */
  setInputEnabled(enabled) {
    this.elements.input.disabled = !enabled;
    this.elements.sendBtn.setAttribute(
      "aria-disabled",
      enabled ? "false" : "true",
    );
    this.elements.sendBtn.setAttribute("tabindex", enabled ? "0" : "-1");
    if (enabled && window.innerWidth > SIZES.MOBILE_BREAKPOINT) {
      this.elements.input.focus();
    }
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
   * Sets document background and browser chrome to match the title bar color.
   */
  _applyDocumentChrome(color) {
    document.documentElement.style.background = color;
    document.body.style.background = color;
    this._setThemeColor(color);
  }

  _setThemeColor(color) {
    if (!this._themeMetaEl) {
      this._themeMetaEl = document.querySelector('meta[name="theme-color"]');
    }
    if (!this._themeMetaEl) {
      this._themeMetaEl = document.createElement('meta');
      this._themeMetaEl.name = 'theme-color';
      document.head.appendChild(this._themeMetaEl);
    }
    this._themeMetaEl.content = color;
  }

  /**
   * Sets up visualViewport listener for iOS keyboard-aware resizing
   */
  _setupViewportHandler() {
    const vv = window.visualViewport;
    if (!vv) return;

    this._inputArea = this.elements.window.querySelector('.chat-input-area');
    this._keyboardOpen = false;
    this._pendingViewportRAF = false;

    this._viewportHandler = () => {
      if (window.innerWidth > SIZES.MOBILE_BREAKPOINT) return;
      if (!this.elements.window.classList.contains('open')) return;
      if (this._pendingViewportRAF) return;

      this._pendingViewportRAF = true;
      requestAnimationFrame(() => {
        this._pendingViewportRAF = false;
        const keyboardOffset = window.innerHeight - vv.height - vv.offsetTop;
        const isOpen = keyboardOffset > 100;

        if (isOpen) {
          const inputHeight = this._inputArea ? this._inputArea.offsetHeight : 60;
          if (this._inputArea) {
            this._inputArea.style.bottom = (keyboardOffset + 4) + 'px';
          }
          this.elements.messages.style.paddingBottom = (keyboardOffset + inputHeight + 16) + 'px';
          if (!this._keyboardOpen) {
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
          }
          this._keyboardOpen = true;
        } else if (this._keyboardOpen) {
          if (this._inputArea) this._inputArea.style.bottom = '';
          this.elements.messages.style.paddingBottom = '';
          this._keyboardOpen = false;
        }
      });
    };

    vv.addEventListener('resize', this._viewportHandler);
    vv.addEventListener('scroll', this._viewportHandler);
  }

  /**
   * Binds event listeners
   */
  _bindEvents() {
    this._handlers = {};

    // Track keyboard vs mouse navigation so the input container focus ring
    // only appears during keyboard use (Tab), not on click or programmatic focus.
    this._handlers.keyboardNavOn = (e) => {
      if (e.key === "Tab") this.elements.window.classList.add("keyboard-nav");
    };
    this._handlers.keyboardNavOff = () => {
      this.elements.window.classList.remove("keyboard-nav");
    };
    document.addEventListener("keydown", this._handlers.keyboardNavOn);
    document.addEventListener("mousedown", this._handlers.keyboardNavOff);

    this._handlers.buttonClick = () => {
      this.eventBus.emit("toggle");
    };
    this.elements.button.addEventListener("click", this._handlers.buttonClick);

    this._handlers.closeClick = () => {
      this.eventBus.emit("close");
    };
    this.elements.closeBtn.addEventListener("click", this._handlers.closeClick);

    this._handlers.clearClick = () => {
      this.eventBus.emit("clear");
    };
    this.elements.clearBtn.addEventListener("click", this._handlers.clearClick);

    if (this.elements.privateBtn) {
      this._handlers.privateClick = () => {
        this.eventBus.emit("togglePrivate");
      };
      this.elements.privateBtn.addEventListener("click", this._handlers.privateClick);
    }

    this._handlers.sendClick = () => {
      if (this.elements.sendBtn.getAttribute("aria-disabled") !== "true") {
        this.eventBus.emit("send", this.getInputValue());
      }
    };
    this.elements.sendBtn.addEventListener("click", this._handlers.sendClick);

    this._handlers.inputKeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (this.elements.sendBtn.getAttribute("aria-disabled") !== "true") {
          this.eventBus.emit("send", this.getInputValue());
        }
      }
    };
    this.elements.input.addEventListener(
      "keydown",
      this._handlers.inputKeydown,
    );

    this._handlers.inputInput = () => {
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
    };
    this.elements.input.addEventListener("input", this._handlers.inputInput);

    // Mobile keyboard handling — visualViewport manages container + input positioning
    this._setupViewportHandler();

    this._handlers.inputFocus = () => {
      if (window.innerWidth <= SIZES.MOBILE_BREAKPOINT) {
        setTimeout(() => {
          this._scrollToBottom();
        }, TIMINGS.IOS_KEYBOARD_DELAY);
      }
    };
    this.elements.input.addEventListener("focus", this._handlers.inputFocus);

    this._handlers.inputBlur = () => {
      // visualViewport resize handler restores positioning automatically
    };
    this.elements.input.addEventListener("blur", this._handlers.inputBlur);

    this._handlers.documentEscape = (e) => {
      if (
        e.key === "Escape" &&
        this.elements.window.classList.contains("open")
      ) {
        this.eventBus.emit("close");
      }
    };
    document.addEventListener("keydown", this._handlers.documentEscape);
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
   * Injects CSS styles
   */
  _injectStyles() {
    const styleId = `universal-chat-styles-${this._id}`;
    if (document.getElementById(styleId)) return;

    const styleGenerator = new StyleGenerator(this.options);
    styleGenerator.injectExternalAssets();
    const styles = document.createElement("style");
    styles.id = styleId;
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
    this.elements.button.id = `${this._id}-btn`;
    const btnContent = this.options.buttonContent;
    if (this.options.buttonIconUrl) {
      this._setButtonIcon();
    } else {
      this.elements.button.textContent = btnContent;
    }
    // Detect if content is NOT a single emoji — if text, use smaller font
    const isSingleEmoji = /^\p{Extended_Pictographic}$/u.test(btnContent);
    this._isTextContent = !isSingleEmoji && btnContent !== "💬" && !this.options.buttonIconUrl;
    if (this._isTextContent) {
      this.elements.button.classList.add("button-text-content");
    }
    this.elements.button.setAttribute(
      "aria-label",
      _t(this.options.language, "openChatAriaLabel"),
    );
    this.elements.button.setAttribute("aria-expanded", "false");
    this.elements.button.setAttribute("aria-haspopup", "dialog");
    this.elements.button.setAttribute("tabindex", "0");
    this.elements.button.title = _t(this.options.language, "openChat");

    // Unread badge. aria-hidden because the visible count is conveyed through
    // the button's dynamic aria-label (updated by updateUnreadBadge); this
    // avoids duplicate announcements.
    this.elements.unreadBadge = document.createElement("span");
    this.elements.unreadBadge.className = "chat-unread-badge";
    this.elements.unreadBadge.style.display = "none";
    this.elements.unreadBadge.setAttribute("aria-hidden", "true");
    this.elements.button.appendChild(this.elements.unreadBadge);

    // Per-widget screen reader live region. Used to announce new messages
    // while the chat is closed so users don't miss assistant replies.
    this.elements.srLive = document.createElement("div");
    this.elements.srLive.className = "sr-only";
    this.elements.srLive.setAttribute("aria-live", "polite");
    this.elements.srLive.setAttribute("aria-atomic", "true");
    this.elements.button.appendChild(this.elements.srLive);

    // Typing indicator for button
    this.elements.buttonTypingIndicator = document.createElement("div");
    this.elements.buttonTypingIndicator.className = "button-typing-indicator";
    this.elements.buttonTypingIndicator.innerHTML =
      "<span></span><span></span><span></span>";
    this.elements.buttonTypingIndicator.style.display = "none";
    this.elements.buttonTypingIndicator.setAttribute("role", "status");
    this.elements.buttonTypingIndicator.setAttribute(
      "aria-label",
      _t(this.options.language, "assistantTyping"),
    );
    this.elements.button.appendChild(this.elements.buttonTypingIndicator);

    // Window
    this.elements.window = document.createElement("div");
    this.elements.window.className = "universal-chat-window";
    this.elements.window.id = this._id;
    this.elements.window.setAttribute("role", "dialog");
    this.elements.window.setAttribute("aria-label", this.options.title);
    this.elements.window.setAttribute("aria-modal", "false");
    const lang = this.options.language;
    const subtitleHtml = this.options.headerSubtitle
      ? `<p class="chat-header-subtitle">${_renderSimpleMarkdown(this.options.headerSubtitle)}</p>`
      : "";
    // Note: innerHTML is used here intentionally — all dynamic values are escaped via
    // ChatValidators.escapeHtml or _renderSimpleMarkdown (which escapes then allows only https links).
    // Translation strings from _t() are static constants defined in TRANSLATIONS.
    this.elements.window.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-info">
          <h3 id="chat-title">${ChatValidators.escapeHtml(this.options.title)}</h3>
          ${subtitleHtml}
        </div>
        <div class="chat-header-actions">
          ${this.options.allowPrivateMode ? `<button class="chat-header-btn chat-private-btn" title="${_t(lang, "privateMode")}" aria-label="${_t(lang, "privateMode")}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>` : ""}
          <button class="chat-header-btn chat-clear-btn" title="${_t(lang, "clearChat")}" aria-label="${_t(lang, "clearChatHistory")}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg></button>
          <button class="chat-header-btn chat-close-btn" title="${_t(lang, "minimize")}" aria-label="${_t(lang, "closeChat")}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      </div>
      ${this.options.showModelInfo ? '<div class="model-info" id="model-info" role="status"></div>' : ""}
      <div class="chat-messages" role="log" aria-live="polite" aria-atomic="false" aria-label="${_t(lang, "chatConversation")}"></div>
      <div class="chat-input-area">
        <div class="chat-input-container">
          <textarea
            class="chat-input"
            placeholder="${ChatValidators.escapeHtml(this.options.placeholder)}"
            maxlength="${LIMITS.MAX_MESSAGE_LENGTH}"
            rows="1"
            aria-label="${_t(lang, "inputAriaLabel")}"
            aria-describedby="char-limit keyboard-hints"></textarea>
          <button class="chat-send-btn" tabindex="-1" aria-disabled="true" aria-label="${_t(lang, "sendAriaLabel")}">${_t(lang, "send")}</button>
        </div>
        <div id="char-limit" class="sr-only">${_t(lang, "charLimit")}</div>
        <div id="keyboard-hints" class="sr-only">${_t(lang, "keyboardHints")}</div>
      </div>
    `;

    const isIframe = this.options.mode === "iframe";
    const isInline = this.options.mode === "inline";
    if (isIframe || isInline) {
      const closeBtn = this.elements.window.querySelector(".chat-close-btn");
      if (closeBtn) { closeBtn.style.display = "none"; closeBtn.setAttribute("tabindex", "-1"); }
    }
    if (isIframe) {
      this.elements.window.classList.add("open", "iframe-mode");
      this._applyDocumentChrome(this.options.titleBackgroundColor);
    } else if (isInline) {
      this.elements.window.classList.add("open", "inline-mode");
    }

    if (!isIframe && !isInline) {
      document.body.appendChild(this.elements.button);
    }
    let mountTarget = document.body;
    if (isInline) {
      const container = this.options.container;
      if (typeof container === "string") {
        mountTarget = document.querySelector(container) || document.body;
      } else if (container instanceof HTMLElement) {
        mountTarget = container;
      } else if (this._scriptElement?.parentElement) {
        mountTarget = this._scriptElement.parentElement;
      }
    }
    mountTarget.appendChild(this.elements.window);
    requestAnimationFrame(() => {
      this.elements.window.classList.add("chat-ready");
    });

    this.elements.messages =
      this.elements.window.querySelector(".chat-messages");
    this.elements.input = this.elements.window.querySelector(".chat-input");
    this.elements.sendBtn =
      this.elements.window.querySelector(".chat-send-btn");
    this.elements.closeBtn =
      this.elements.window.querySelector(".chat-close-btn");
    this.elements.clearBtn =
      this.elements.window.querySelector(".chat-clear-btn");
    this.elements.privateBtn =
      this.elements.window.querySelector(".chat-private-btn");
    this.elements.modelInfo = this.elements.window.querySelector("#model-info");
  }

  /**
   * Applies or removes private mode visual indicators (button state,
   * placeholder text, window outline).
   */
  setPrivateMode(active, borderColor) {
    if (!this.options.allowPrivateMode) return;
    const lang = this.options.language;
    const btn = this.elements.privateBtn;
    if (btn) {
      const svg = btn.querySelector("svg");
      if (svg) {
        svg.setAttribute("fill", active ? "currentColor" : "none");
      }
      btn.title = active ? _t(lang, "privateModeOn") : _t(lang, "privateMode");
      btn.setAttribute("aria-label", btn.title);
    }
    // Update placeholder
    if (this.elements.input) {
      this.elements.input.placeholder = active
        ? _t(lang, "privatePlaceholder")
        : this.options.placeholder;
    }
    // Update border
    if (this.elements.window) {
      if (active && borderColor !== "transparent") {
        this.elements.window.style.outline = `2px solid ${borderColor}`;
      } else {
        this.elements.window.style.outline = "";
      }
    }
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

    // Clean up visualViewport listener
    if (this._viewportHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._viewportHandler);
      window.visualViewport.removeEventListener('scroll', this._viewportHandler);
    }

    if (this.accessibilityManager) {
      this.accessibilityManager.remove();
    }

    // Remove all stored event listeners
    if (this._handlers) {
      if (this.elements.button) {
        this.elements.button.removeEventListener(
          "click",
          this._handlers.buttonClick,
        );
      }
      if (this.elements.closeBtn) {
        this.elements.closeBtn.removeEventListener(
          "click",
          this._handlers.closeClick,
        );
      }
      if (this.elements.clearBtn) {
        this.elements.clearBtn.removeEventListener(
          "click",
          this._handlers.clearClick,
        );
      }
      if (this.elements.privateBtn && this._handlers.privateClick) {
        this.elements.privateBtn.removeEventListener(
          "click",
          this._handlers.privateClick,
        );
      }
      if (this.elements.sendBtn) {
        this.elements.sendBtn.removeEventListener(
          "click",
          this._handlers.sendClick,
        );
      }
      if (this.elements.input) {
        this.elements.input.removeEventListener(
          "keydown",
          this._handlers.inputKeydown,
        );
        this.elements.input.removeEventListener(
          "input",
          this._handlers.inputInput,
        );
        this.elements.input.removeEventListener(
          "focus",
          this._handlers.inputFocus,
        );
        this.elements.input.removeEventListener(
          "blur",
          this._handlers.inputBlur,
        );
      }
      document.removeEventListener("keydown", this._handlers.documentEscape);
      document.removeEventListener("keydown", this._handlers.keyboardNavOn);
      document.removeEventListener("mousedown", this._handlers.keyboardNavOff);
      this._handlers = null;
    }

    if (this._themeMetaEl) {
      this._themeMetaEl.remove();
      this._themeMetaEl = null;
    }

    if (this.elements.button) this.elements.button.remove();
    if (this.elements.window) this.elements.window.remove();

    const styleEl = document.getElementById(
      `universal-chat-styles-${this._id}`,
    );
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
  static _instanceCount = 0;

  constructor(options = {}) {
    // Generate unique instance ID for multi-instance support
    this._instanceId = `chat-${UniversalChatWidget._instanceCount++}`;
    // Capture script element now (unavailable after async operations)
    this._scriptElement = document.currentScript;

    if (options.configUrl) {
      // Fetch remote config, then initialize — hide widget on failure
      this._initFromRemoteConfig(options);
    } else {
      this._initWidget(options);
    }
  }

  /**
   * Fetches config from remote URL, merges with local options, then initializes.
   * If fetch fails, the widget is never created (hidden).
   */
  async _initFromRemoteConfig(options) {
    try {
      const resp = await fetch(options.configUrl);
      if (!resp.ok) throw new Error(`Config fetch failed: ${resp.status}`);
      const remoteConfig = await resp.json();
      // Remote config is base, local options override
      const merged = { ...remoteConfig, ...options };
      delete merged.configUrl;
      this._initWidget(merged);
    } catch (e) {
      if (options.debug) {
        console.warn(`[ChatWidget] Failed to load config from ${options.configUrl}:`, e);
      }
      // Widget stays hidden — never created
    }
  }

  /**
   * Core initialization — called directly or after remote config fetch.
   */
  _initWidget(options) {
    // Normalize and validate options
    this.options = this._normalizeOptions(options);
    this.options._instanceId = `${this._instanceId}_${this.options.model}`;

    // WCAG contrast sanity check. Developer-facing safeguard: logs a warning
    // if any configured text/background pair falls below the AA threshold
    // (4.5:1 for body text). Does NOT block rendering.
    ColorUtils.warnLowContrast(this.options);

    // Initialize core components
    this.eventBus = new EventBus();
    this.state = new ChatState(this.options);
    this.api = new ChatAPI(this.options.apiEndpoint, this.options.model, {
      debug: this.options.debug,
      timeout: this.options.requestTimeout,
      language: this.options.language,
    });
    this.renderer = new MessageRenderer(this.options);
    this.ui = new ChatUI(this.options, this.eventBus);

    // Subscribe to events
    this._subscribeToEvents();

    // Initialize UI
    this.ui.init();

    // Load marked.js, then render messages (restored history or defer welcome)
    this.renderer._loadRenderer().then(() => {
      if (this.state.restore()) {
        this._rebuildMessagesFromHistory();
        // Restore private mode visuals if active
        if (this.state.get("privateMode")) {
          this.ui.setPrivateMode(true, this.options.privateModeBorderColor);
        }
      } else {
        this._needsWelcome = true;
      }

      // Auto-open if configured
      if (this.options.startOpen && !this.state.get("hasInteracted")) {
        setTimeout(() => this._handleOpen(), TIMINGS.START_OPEN_DELAY);
      }
    });
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
    this.eventBus.on("togglePrivate", () => this._handleTogglePrivate());

    // Subscribe to state changes
    this._stateUnsub = this.state.subscribe((newState, oldState) => {
      if (newState.isOpen !== oldState.isOpen) {
        newState.isOpen ? this.ui.open() : this.ui.close();
      }

      if (newState.unreadCount !== oldState.unreadCount) {
        this.ui.updateUnreadBadge(newState.unreadCount);
      }

      // Only save when persisted fields change
      if (newState.history !== oldState.history ||
          newState.hasInteracted !== oldState.hasInteracted ||
          newState.traceId !== oldState.traceId ||
          newState.sessionId !== oldState.sessionId ||
          newState.privateMode !== oldState.privateMode) {
        this.state.save();
      }
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
    if (this._needsWelcome) {
      this._needsWelcome = false;
      this._showWelcomeMessage();
    }
    this._trackEvent('chat_open');
  }

  /**
   * Handles closing chat
   */
  _handleClose() {
    this._trackEvent('chat_close', {
      messages: this.state.get('history').length,
    });
    this.state.update({ isOpen: false });
  }

  /**
   * Handles clearing chat
   */
  _handleClear() {
    this._trackEvent('chat_cleared', {
      messages: this.state.get('history').length,
    });
    this.state.update({ history: [], traceId: null });
    this.ui.clearMessages();
    this._showWelcomeMessage();
  }

  /**
   * Tracks analytics events via Umami, Plausible, or custom callback
   */
  _trackEvent(name, data = {}) {
    if (typeof this.options.onEvent === 'function') {
      try { this.options.onEvent(name, data); } catch (_) {}
    }

    if (this.options.analytics === false) return;

    if (typeof window.umami !== 'undefined' && typeof window.umami.track === 'function') {
      try { window.umami.track(name, data); } catch (_) {}
    }

    if (typeof window.plausible === 'function') {
      try { window.plausible(name, { props: data }); } catch (_) {}
    }
  }

  _handleTogglePrivate() {
    const newVal = !this.state.get("privateMode");
    this.state.update({ privateMode: newVal });
    this.ui.setPrivateMode(newVal, this.options.privateModeBorderColor);
  }

  /**
   * Handles sending message
   */
  async _handleSend(message, isRetry = false) {
    if (!message) return;

    // Guard against concurrent sends
    if (this.state.get("isSending")) return;
    this.state.update({ isSending: true });
    this.ui.setInputEnabled(false);

    // Add user message to state and UI (skip if retry — already in history)
    if (!isRetry) {
      const history = [...this.state.get("history"), { role: "user", content: message }];
      this.state.update({ history });

      const formatted = this.renderer.formatMessage(message);
      this.ui.addMessage("user", formatted, this._formatTime(new Date()));
      this._trackEvent('chat_message_sent', { length: message.length });
    }

    this.ui.clearInput();
    this.ui.showTyping();

    if (!this.state.get("isOpen")) {
      this.ui.showButtonTyping();
    }

    const sendTimestamp = Date.now();

    // Use streaming by default; fall back to non-streaming if stream option is explicitly false
    if (this.options.stream !== false) {
      await this._handleSendStreaming(message, sendTimestamp);
    } else {
      await this._handleSendNonStreaming(message, sendTimestamp);
    }
  }

  /**
   * Streaming send path — progressive token display with debounced markdown render
   */
  async _handleSendStreaming(message, sendTimestamp) {
    const optimizedHistory = this.state.optimizeHistory();
    let rawText = "";
    let pendingSources = [];
    let assistantEl = null;
    let bubbleEl = null;
    let debounceTimer = null;
    let streamErrorOccurred = false;
    let doneWasCalled = false;

    const renderContent = () => {
      if (!bubbleEl || !bubbleEl.isConnected) return;
      // Read scroll position before DOM write to avoid layout thrashing
      const msgs = this.ui.elements.messages;
      const isNearBottom = msgs.scrollTop + msgs.clientHeight >= msgs.scrollHeight - 60;
      bubbleEl.innerHTML = this.renderer.formatMessage(rawText); // existing sanitized render
      if (isNearBottom) {
        this.ui._scrollToBottom();
      }
    };

    try {
      await this.api.sendMessageStreaming(
        message,
        optimizedHistory,
        this.state.get("traceId"),
        this.state.get("sessionId"),
        this.state.get("privateMode"),
        {
          onDelta: (content) => {
            if (!assistantEl) {
              this.ui.hideTyping();
              this.ui.hideButtonTyping();
              assistantEl = this.ui.addStreamingMessage(this._formatTime(new Date()));
              bubbleEl = assistantEl.querySelector(".message-bubble");
            }
            rawText += content;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(renderContent, 80);
          },

          onSources: (sources) => {
            pendingSources = Array.isArray(sources) ? sources : [];
          },

          onDone: (payload) => {
            if (streamErrorOccurred) return;
            doneWasCalled = true;
            clearTimeout(debounceTimer);

            if (!assistantEl) {
              this.ui.hideTyping();
              this.ui.hideButtonTyping();
              assistantEl = this.ui.addStreamingMessage(this._formatTime(new Date()));
              bubbleEl = assistantEl.querySelector(".message-bubble");
            }

            renderContent();
            this.renderer.addCopyButtonsToCodeBlocks(assistantEl);
            this.renderer.renderCitations(assistantEl, pendingSources);

            this._onResponseComplete(rawText, {
              traceId: payload.traceId,
              sessionId: payload.sessionId,
              model: payload.model,
            }, sendTimestamp);
          },

          onError: (error) => {
            streamErrorOccurred = true;
            console.error("Streaming error:", error);
            clearTimeout(debounceTimer);

            if (assistantEl && rawText) {
              renderContent();
              const errorNotice = document.createElement("div");
              errorNotice.className = "stream-error-notice";
              errorNotice.textContent = error.message || _t(this.options.language, "errorStreamLost");
              if (bubbleEl) bubbleEl.appendChild(errorNotice);

              this.state.update({
                history: [
                  ...this.state.get("history"),
                  { role: "assistant", content: rawText },
                ],
                lastFailedMessage: null,
              });
            } else {
              this._onSendError(message, error);
            }
          },
        },
      );

      // Fallback: stream ended without any callbacks firing (e.g. non-SSE response)
      if (!rawText && !streamErrorOccurred && !assistantEl) {
        const noCallbackError = new Error("No response received from server");
        noCallbackError.errorInfo = { type: "parse", message: _t(this.options.language, "errorUnknown") };
        this._onSendError(message, noCallbackError);
      }
      // Fallback: stream ended with content but onDone never fired
      if (rawText && !streamErrorOccurred && !doneWasCalled && assistantEl) {
        clearTimeout(debounceTimer);
        renderContent();
        this.renderer.addCopyButtonsToCodeBlocks(assistantEl);
        this.renderer.renderCitations(assistantEl, pendingSources);
        this._onResponseComplete(rawText, {
          traceId: this.state.get("traceId"),
          sessionId: this.state.get("sessionId"),
        }, sendTimestamp);
      }
    } catch (error) {
      if (!streamErrorOccurred) {
        this._onSendError(message, error);
      }
    } finally {
      this.state.update({ isSending: false });
      this.ui.setInputEnabled(true);
    }
  }

  /**
   * Non-streaming send path (original behavior, used when stream option is false)
   */
  async _handleSendNonStreaming(message, sendTimestamp) {
    try {
      const optimizedHistory = this.state.optimizeHistory();
      const response = await this.api.sendMessage(
        message,
        optimizedHistory,
        this.state.get("traceId"),
        this.state.get("sessionId"),
        this.state.get("privateMode"),
      );

      this.ui.hideTyping();
      this.ui.hideButtonTyping();
      const formattedResponse = this.renderer.formatMessage(response.content);
      const assistantEl = this.ui.addMessage(
        "assistant",
        formattedResponse,
        this._formatTime(new Date()),
      );

      this.renderer.addCopyButtonsToCodeBlocks(assistantEl);
      this.renderer.renderCitations(assistantEl, response.sources);

      this._onResponseComplete(response.content, {
        traceId: response.traceId,
        sessionId: response.sessionId,
        model: response.model,
      }, sendTimestamp);
    } catch (error) {
      this._onSendError(message, error);
    } finally {
      this.state.update({ isSending: false });
      this.ui.setInputEnabled(true);
    }
  }

  /**
   * Shared post-response state update and UI bookkeeping
   */
  _onResponseComplete(content, { traceId, sessionId, model }, sendTimestamp) {
    this.state.update({
      history: [
        ...this.state.get("history"),
        { role: "assistant", content },
      ],
      traceId: traceId || this.state.get("traceId"),
      sessionId: sessionId || this.state.get("sessionId"),
      lastFailedMessage: null,
    });
    this.state.trimHistory();

    if (this.ui.elements.modelInfo && model) {
      this.ui.elements.modelInfo.textContent = `Model: ${model}`;
    }

    this._trackEvent('chat_response_received', {
      latency: Date.now() - sendTimestamp,
      model: model || this.options.model,
    });

    if (!this.state.get("isOpen")) {
      this.state.update({
        unreadCount: this.state.get("unreadCount") + 1,
      });
      this.ui.showMessagePreview(content);
      this.ui.pulseButton();
    }
  }

  /**
   * Shared error handler for both send paths
   */
  _onSendError(message, error) {
    console.error("Chat error:", error);
    this.ui.hideTyping();
    this.ui.hideButtonTyping();
    this.state.update({ lastFailedMessage: message });
    this._trackEvent('chat_error', { type: error.message || 'unknown' });
    const errorInfo = error.errorInfo || {
      message: _t(this.options.language, "errorUnknown"),
    };
    this.ui.showError(errorInfo.message);
  }

  /**
   * Handles retry
   */
  async _handleRetry() {
    const message = this.state.get("lastFailedMessage");
    if (message) {
      await this._handleSend(message, true);
    }
  }

  /**
   * Shows welcome message
   */
  _showWelcomeMessage() {
    // Random delay 1-3 seconds with typing indicator for realism
    const delay = TIMINGS.WELCOME_DELAY_MIN + Math.random() * TIMINGS.WELCOME_DELAY_RANGE;
    this.ui.showTyping();
    this._welcomeTimer = setTimeout(() => {
      this.ui.hideTyping();
      const formatted = this.renderer.formatMessage(this.options.welcomeMessage);
      const welcomeEl = this.ui.addMessage(
        "assistant",
        formatted,
        this._formatTime(new Date()),
      );
      this.renderer.addCopyButtonsToCodeBlocks(welcomeEl);
      this.renderer.renderCitations(welcomeEl, []);
      // Add to history so LLM has context and rebuild works
      this.state.update({
        history: [
          ...this.state.get("history"),
          { role: "assistant", content: this.options.welcomeMessage },
        ],
      });
    }, delay);
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
          this.renderer.renderCitations(msgEl, []);
        }
      });
    } else {
      this._showWelcomeMessage();
    }
  }

  /**
   * Normalizes options with defaults
   */
  _normalizeOptions(options) {
    const lang = options.language || "en";
    const color = (key, fallback) => ChatValidators.validateColor(options[key]) || fallback;
    const clamp = (val, min, max, fallback) => { const n = parseFloat(val); return Math.max(min, Math.min(max, isNaN(n) ? fallback : n)); };
    const clampOpt = (val, min, max) => val != null ? Math.max(min, Math.min(max, parseFloat(val))) : null;
    return {
      language: lang,
      headerSubtitle: options.headerSubtitle || "",
      title: options.title || _t(lang, "title"),
      welcomeMessage:
        options.welcomeMessage || _t(lang, "welcomeMessage"),
      placeholder: options.placeholder || _t(lang, "placeholder"),
      position: options.position || "bottom-right",
      apiEndpoint:
        ChatValidators.validateApiEndpoint(options.apiEndpoint) ||
        "https://your-worker.workers.dev",
      model:
        ChatValidators.validateModel(options.model) || "mistral-medium-latest",
      titleBackgroundColor: color("titleBackgroundColor", "#363D45"),
      titleFontColor: color("titleFontColor", "#FDF8ED"),

      assistantColor: color("assistantColor", "#FCCF9C"),
      assistantFontColor: color("assistantFontColor", "#3B332B"),
      assistantMessageOpacity: options.assistantMessageOpacity ?? 0.9,

      userColor: color("userColor", "#A7C7C6"),
      userFontColor: color("userFontColor", "#283E3D"),
      userMessageOpacity: options.userMessageOpacity ?? 0.9,

      chatBackground: color("chatBackground", "#ffffff"),
      stampColor: color("stampColor", "#DB6B6B"),
      codeBackgroundColor: color("codeBackgroundColor", "#FFEEE2"),
      codeOpacity: options.codeOpacity ?? 0.9,
      codeTextColor: color("codeTextColor", "#537E8F"),

      subtitleColor: color("subtitleColor", null),
      subtitleFontSize: clamp(options.subtitleFontSize, 0.5, 0.8, 0.65),
      windowBorderColor: color("windowBorderColor", "transparent"),
      headerBorderColor: color("headerBorderColor", "#363D45"),
      assistantBubbleBorderColor: color("assistantBubbleBorderColor", "#363D45"),
      userBubbleBorderColor: color("userBubbleBorderColor", "#363D45"),
      inputBorderColor: color("inputBorderColor", "#363D45"),
      codeBorderColor: color("codeBorderColor", "#363D45"),
      citationBorderColor: color("citationBorderColor", "#363D45"),
      buttonIconColor: color("buttonIconColor", "#363D45"),
      scrollbarColor: color("scrollbarColor", "#FDF8ED"),
      inputTextColor: color("inputTextColor", "#363D45"),

      inputAreaOpacity: options.inputAreaOpacity ?? 0.95,
      buttonShadowIntensity: clamp(options.buttonShadowIntensity, 0, 1, 1.0),
      windowShadowIntensity: clamp(options.windowShadowIntensity, 0, 1, 1.0),
      inputShadowIntensity: clampOpt(options.inputShadowIntensity, 0, 1),
      borderRadius: Math.max(0, Math.min(SIZES.MAX_BORDER_RADIUS, parseInt(options.borderRadius) || 0)),
      buttonInactiveColor: color("buttonInactiveColor", null),
      buttonActiveColor: color("buttonActiveColor", null),
      buttonContent: (typeof options.buttonContent === "string" ? options.buttonContent.slice(0, 10) : "") || "💬",
      buttonIconUrl: typeof options.buttonIconUrl === "string" && options.buttonIconUrl ? options.buttonIconUrl : null,
      startOpen: options.startOpen ?? false,
      buttonSize: options.buttonSize ?? SIZES.BUTTON_SIZE,
      windowWidth: options.windowWidth ?? SIZES.WINDOW_WIDTH,
      windowHeight: options.windowHeight ?? SIZES.WINDOW_HEIGHT,
      showModelInfo: options.showModelInfo ?? false,
      maxHistoryTokens: options.maxHistoryTokens ?? LIMITS.MAX_HISTORY_TOKENS,
      alwaysKeepRecentMessages:
        options.alwaysKeepRecentMessages ?? LIMITS.ALWAYS_KEEP_RECENT,
      maxHistoryMessages:
        options.maxHistoryMessages ?? LIMITS.MAX_HISTORY_MESSAGES,
      stream: options.stream ?? true,
      debug: options.debug ?? false,
      requestTimeout: options.requestTimeout ?? TIMINGS.REQUEST_TIMEOUT,
      mode: options.mode || "floating",
      container: options.container || null,
      allowPrivateMode: options.allowPrivateMode ?? false,
      privateModeBorderColor: color("privateModeBorderColor", "transparent"),
      analytics: options.analytics ?? true,
      onEvent: typeof options.onEvent === 'function' ? options.onEvent : null,
    };
  }

  /**
   * Formats time
   */
  _formatTime(date) {
    return _timeFormatter.format(date);
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
    clearTimeout(this._welcomeTimer);
    if (this.api) this.api.cancel();
    if (this.eventBus) this.eventBus.clear();
    if (this.ui) this.ui.destroy();
    if (this._stateUnsub) this._stateUnsub();
    this.state = null;
    this.api = null;
    this.renderer = null;
    this.eventBus = null;
  }
}

// ============================================================================
// AUTO-INITIALIZATION & EXPORT
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  const autoInit = document.querySelector("[data-chat-widget]");
  if (autoInit) {
    let options = {};
    try {
      options = autoInit.dataset.chatWidget
        ? JSON.parse(autoInit.dataset.chatWidget)
        : {};
    } catch (e) {
      console.warn(
        "Chat Widget: Invalid JSON in data-chat-widget attribute:",
        e.message,
      );
    }
    window.chatWidget = new UniversalChatWidget(options);
  }
});

window.UniversalChatWidget = UniversalChatWidget;
})();
