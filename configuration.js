// Universal AI Chat Widget Configuration Examples
// Uncomment and modify the configuration that matches your API provider

// =============================================================================
// OpenAI API Compatible
// =============================================================================
new UniversalChatWidget({
  // Basic Settings
  title: "Course Assistant",
  subtitle: "Applied Optimization",

  // Main theme colors
  primaryColor: "#99bfbb", // Main brand color (user messages, buttons)
  secondaryColor: "#0f6466", // Hover states, focus rings, accents
  backgroundColor: "#ffffff", // Window background
  headerBackgroundColor: "#fdcd9a", // Header background (both title and subtitle rows)

  // Message styling
  userMessageColor: "#99bfbb", // User message bubbles
  assistantMessageColor: "#fdcd9a", // Assistant message bubbles
  messageBorderColor: "#7da3a0", // Border for both message types

  // Text colors
  textColor: "#ffffff", // Text on colored backgrounds (buttons)
  headerTextColor: "#1f2937", // Text in header (title and subtitle)
  userTextColor: "#1f2937", // Text in user message bubbles
  assistantTextColor: "#1f2937", // Text in assistant message bubbles
  mutedTextColor: "#6b7280", // Timestamps, secondary text

  // Position and layout
  position: "bottom-right", // bottom-right, bottom-left, top-right, top-left

  // Behavior
  startOpen: false,
  buttonSize: 60,
  windowWidth: 450,
  windowHeight: 600,

  // Messages
  welcomeMessage: "Hi! I'm your AI assistant. How can I help you today?",
  placeholder: "Ask me anything...",

  // Debug mode (enable for development)
  debug: false,
});

// =============================================================================
// Alternative Color Schemes
// =============================================================================

// Professional Blue Theme
/*
new UniversalChatWidget({
  title: "Support Assistant",
  subtitle: "Technical Help",
  primaryColor: "#2563eb",
  secondaryColor: "#1d4ed8",
  backgroundColor: "#ffffff",
  headerBackgroundColor: "#e0e7ff",
  userMessageColor: "#3b82f6",
  assistantMessageColor: "#f1f5f9",
  messageBorderColor: "#cbd5e1",
  headerTextColor: "#1e293b",
  userTextColor: "#ffffff",
  assistantTextColor: "#1e293b",
  mutedTextColor: "#64748b",
});
*/

// Dark Theme
/*
new UniversalChatWidget({
  title: "AI Assistant",
  subtitle: "Dark Mode",
  primaryColor: "#374151",
  secondaryColor: "#4b5563",
  backgroundColor: "#1f2937",
  headerBackgroundColor: "#4b5563",
  userMessageColor: "#4b5563",
  assistantMessageColor: "#374151",
  messageBorderColor: "#6b7280",
  headerTextColor: "#f9fafb",
  userTextColor: "#f9fafb",
  assistantTextColor: "#f9fafb",
  mutedTextColor: "#9ca3af",
});
*/

// Warm Orange Theme
/*
new UniversalChatWidget({
  title: "Learning Assistant",
  subtitle: "Educational Support",
  primaryColor: "#ea580c",
  secondaryColor: "#dc2626",
  backgroundColor: "#ffffff",
  headerBackgroundColor: "#fed7aa",
  userMessageColor: "#fb923c",
  assistantMessageColor: "#fed7aa",
  messageBorderColor: "#fdba74",
  headerTextColor: "#9a3412",
  userTextColor: "#ffffff",
  assistantTextColor: "#9a3412",
  mutedTextColor: "#78716c",
});
*/
