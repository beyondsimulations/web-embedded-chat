new FloatingChatWidget({
  // Appearance
  title: "🤖 AI Tutor",
  subtitle: "Online 24/7",
  position: "bottom-right", // bottom-right, bottom-left, top-right, top-left

  // Behavior
  startOpen: false, // Open automatically on load?
  buttonSize: 60, // Size of floating button
  windowWidth: 380, // Chat window width
  windowHeight: 600, // Chat window height

  // Messages
  welcomeMessage: "Custom welcome message!",
  placeholder: "Ask me anything...",

  // Color customization (optional - uses modern defaults if not specified)
  colors: {
    primary: "#0f6466", // Main brand color
    secondary: "#fdcd9a", // Secondary accent
    tertiary: "#d99f7e", // Tertiary accent
    quaternary: "#99bfbb", // Borders and subtle elements
    accent: "#df7d7d", // Highlight color
    code: "#F2F0F2", // Code background
    codeline: "#BF4D34", // Code text color
    darker: "#2c3532", // Dark text/backgrounds
    lighter: "#ffffff", // Light backgrounds/text
  },

  // Alternative: Override only specific colors
  // colors: {
  //   primary: "#your-brand-color",
  //   accent: "#your-accent-color",
  // },
});
