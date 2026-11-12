/** Design tokens — paleta oficial BGO (doc mestre §9). */
export const tokens = {
  colors: {
    cyan: "#00D4FF",
    magenta: "#FF2D9B",
    gold: "#FFC107",
    iris: "#8B7DFF",
    base: "#0D0D0D",
    surface: "#16161A",
    surfaceAlt: "#1E1E24",
    text: "#E8E6F0",
    textDim: "#9A97A8",
    danger: "#FF4D6D",
    success: "#3DDC97",
    warning: "#FFC107",
  },
  fonts: {
    heading: "'Sora', 'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  },
  radius: { sm: "6px", md: "10px", lg: "16px" },
  simBadge: "SIMULAÇÃO",
} as const;

export type VisualState =
  | "idle" | "listening" | "processing" | "speaking" | "success" | "error";

export interface AgentVisual {
  state: VisualState;
  awaitingApproval: boolean;
  simulated: boolean;
}

/** Deriva estado visual de um run — nunca inventa atividade. */
export function deriveVisualState(
  runStatus: string | undefined,
  flags: { awaitingApproval?: boolean; simulated?: boolean } = {},
): AgentVisual {
  const map: Record<string, VisualState> = {
    draft: "idle",
    queued: "idle",
    running: "processing",
    waiting_input: "listening",
    awaiting_approval: "processing",
    completed: "success",
    failed: "error",
    cancelled: "idle",
  };
  return {
    state: runStatus ? (map[runStatus] ?? "idle") : "idle",
    awaitingApproval: flags.awaitingApproval ?? false,
    simulated: flags.simulated ?? true,
  };
}
