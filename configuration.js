// Universal AI Chat Widget Configuration Examples
// Uncomment and modify the configuration that matches your API provider

// =============================================================================
// OpenAI API Compatible
// =============================================================================
new UniversalChatWidget({
  // Basic Settings
  title: "Course Assistant",
  subtitle: "Applied Optimization",

  // Main colors
  primaryColor: "#99bfbb", // Green99bfbb
  secondaryColor: "#0f6466", // Darker green for gradient
  textColor: "#ffffff", // White text on colored backgrounds

  // Chat window colors
  backgroundColor: "#ffffff", // Main background
  userMessageColor: "df7d7d", // Override user bubble color
  assistantMessageColor: "fdcd9a", // Assistant bubble background
  assistantBorderColor: "2c3532", // Assistant bubble border

  // Other options
  position: "bottom-right", // bottom-right, bottom-left, top-right, top-left

  // Behavior
  startOpen: false,
  buttonSize: 60,
  windowWidth: 380,
  windowHeight: 600,

  // Messages
  welcomeMessage: "Hi! I'm your AI assistant. How can I help you today?",
  placeholder: "Ask me anything...",

  // Debug mode (enable for development)
  debug: false,
});
