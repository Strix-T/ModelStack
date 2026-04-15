export type ApplyStepId =
  | "system_check"
  | "runtime_setup"
  | "model_download"
  | "environment_setup"
  | "launch";

export type StepStatus = "pending" | "active" | "done" | "failed" | "skipped";

export type ApplyStepState = {
  id: ApplyStepId;
  label: string;
  status: StepStatus;
};

const STEP_LABELS: Record<ApplyStepId, string> = {
  system_check: "System check",
  runtime_setup: "Runtime setup",
  model_download: "Model download",
  environment_setup: "Environment setup",
  launch: "Launch",
};

export function createApplyStepStates(): ApplyStepState[] {
  return (Object.keys(STEP_LABELS) as ApplyStepId[]).map((id) => ({
    id,
    label: STEP_LABELS[id],
    status: "pending" as StepStatus,
  }));
}

export function renderStepList(steps: ApplyStepState[]): string {
  const icon = (s: StepStatus) => {
    switch (s) {
      case "done":
        return "[✔]";
      case "active":
        return "[⏳]";
      case "failed":
        return "[✖]";
      case "skipped":
        return "[–]";
      default:
        return "[ ]";
    }
  };
  return steps.map((s) => `${icon(s.status)} ${s.label}`).join("\n");
}

export function setStepStatus(steps: ApplyStepState[], id: ApplyStepId, status: StepStatus): void {
  const step = steps.find((s) => s.id === id);
  if (step) {
    step.status = status;
  }
}
