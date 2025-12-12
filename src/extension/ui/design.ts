/**
 * Cursor-inspired design system constants
 * Based on Cursor's dark theme design language
 */

export const CURSOR_COLORS = {
  // Backgrounds
  background: "#1e1e1e", // Main background (darker than current #121212)
  backgroundSecondary: "#252526", // Secondary background
  backgroundTertiary: "#2d2d30", // Tertiary background
  
  // Inputs and controls
  inputBackground: "#252526", // Lighter background for input container (like Cursor)
  inputBackgroundContainer: "#2d2d30", // Container background (slightly lighter to indicate clickable area)
  inputBorder: "rgba(255, 255, 255, 0.15)", // Lighter border for visibility
  inputBorderHover: "rgba(255, 255, 255, 0.2)",
  
  // Text
  textPrimary: "#cccccc", // Primary text (slightly softer than #f5f5f5)
  textSecondary: "#858585", // Secondary text
  textMuted: "#6a6a6a", // Muted text
  
  // Buttons
  buttonPrimary: "#4a5568", // Muted grey/blue (like Cursor's muted blue)
  buttonPrimaryHover: "#5a6578",
  buttonSecondary: "#3c3c3c", // Secondary button
  buttonSecondaryHover: "#464647",
  
  // Action buttons
  buttonSuccess: "#0e7c0e", // Green for actions like Summarize
  buttonSuccessHover: "#117a11",
  buttonNeutral: "#3c3c3c", // Neutral gray
  buttonNeutralHover: "#464647",
  
  // Borders and dividers
  border: "rgba(255, 255, 255, 0.1)",
  borderSubtle: "rgba(255, 255, 255, 0.05)",
  divider: "rgba(255, 255, 255, 0.1)",
} as const;

export const CURSOR_SPACING = {
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  xxl: "20px",
} as const;

export const CURSOR_TYPOGRAPHY = {
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: {
    xs: "11px",
    sm: "12px",
    base: "13px",
    md: "14px",
    lg: "16px",
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.2",
    normal: "1.4",
    relaxed: "1.6",
  },
} as const;

export const CURSOR_BORDERS = {
  radius: {
    sm: "4px",
    md: "6px",
    lg: "8px",
  },
  width: {
    thin: "1px",
    medium: "1.5px",
  },
} as const;

