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
  primaryColor: "#10b981", // Green
  secondaryColor: "#059669", // Darker green for gradient
  textColor: "#ffffff", // White text on colored backgrounds

  // Chat window colors
  backgroundColor: "#ffffff", // Main background
  userMessageColor: "#1e40af", // Override user bubble color
  assistantMessageColor: "#f3f4f6", // Assistant bubble background
  assistantBorderColor: "#d1d5db", // Assistant bubble border

  // Other options
  position: "bottom-right", // bottom-right, bottom-left, top-right, top-left

  // Behavior
  startOpen: false,
  buttonSize: 60,
  windowWidth: 380,
  windowHeight: 600,

  // Messages
  welcomeMessage:
    "Hi! I'm your AI assistant powered by GPT. How can I help you today?",
  placeholder: "Ask me anything...",

  // Debug mode (enable for development)
  debug: false,
});
