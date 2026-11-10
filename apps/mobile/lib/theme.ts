export const colors = {
  ink: "#12211b",
  inkDeep: "#101b18",
  signal: "#c8fa56",
  canvas: "#f6f7f2",
  canvasBright: "#fbfcf7",
  muted: "#718078",
  line: "#e0e4dc",
  white: "#ffffff",
  welcome: "#e9ece3",
  welcomeLine: "#d9ddd4",
  soft: "#8a958f",
  star: "#e7a82d",
  cover: "#193027",
} as const;

export type ColorToken = keyof typeof colors;
