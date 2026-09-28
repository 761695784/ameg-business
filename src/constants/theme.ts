export const colors = {
  // Brand Palette - AMEG International
  primary: "#0F2D52", // Deep Navy Blue (identitaire)
  primaryDark: "#0A1F38",
  primaryLight: "#1B4272",
  primarySubtle: "#EAF0F8",

  accent: "#F28C28", // Vibrant Orange (actions principales & focus)
  accentDark: "#D67417",
  accentLight: "#FFF4E8",
  accentSubtle: "#FDE6D0",

  secondary: "#00A8A8", // Teal / Turquoise (accents secondaires & compléments)
  secondaryDark: "#008B8B",
  secondaryLight: "#E6F7F7",
  secondarySubtle: "#C6EFEF",

  // Neutrals & Surfaces
  white: "#FFFFFF",
  background: "#F6F8FB", // Slate ultra-light background
  card: "#FFFFFF",
  cardSubdued: "#F1F5F9",
  cardElevated: "#FFFFFF",

  // Typography Colors
  text: "#0F172A", // Dark slate (high contrast, crisp readability)
  textSecondary: "#334155",
  textMuted: "#64748B",
  muted: "#64748B",
  textLight: "#94A3B8",
  textInverse: "#FFFFFF",

  // Borders & Dividers
  border: "#E2E8F0",
  borderLight: "#EDF2F7",
  borderFocus: "#0F2D52",

  // Semantic Status Colors
  status: {
    brouillon: {
      text: "#475569",
      bg: "#F1F5F9",
      border: "#CBD5E1",
    },
    envoye: {
      text: "#0369A1",
      bg: "#E0F2FE",
      border: "#7DD3FC",
    },
    accepte: {
      text: "#0F766E",
      bg: "#CCFBF1",
      border: "#5EEAD4",
    },
    paye: {
      text: "#15803D",
      bg: "#DCFCE7",
      border: "#86EFAC",
    },
    refuse: {
      text: "#B91C1C",
      bg: "#FEE2E2",
      border: "#FCA5A5",
    },
    annule: {
      text: "#B91C1C",
      bg: "#FEE2E2",
      border: "#FCA5A5",
    },
  },

  // Feedback Colors
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FCA5A5",
  success: "#16A34A",
  successBg: "#F0FDF4",
  successBorder: "#86EFAC",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FDE68A",
  info: "#0284C7",
  infoBg: "#F0F9FF",
  infoBorder: "#BAE6FD",
};

export const shadows = {
  sm: {
    shadowColor: "#0F2D52",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: "#0F2D52",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: "#0F2D52",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const radii = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};
