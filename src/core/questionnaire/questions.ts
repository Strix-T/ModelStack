export const PRIMARY_USE_CASE_OPTIONS = [
  { value: "general_chat", label: "General chat" },
  { value: "writing", label: "Writing" },
  { value: "coding", label: "Coding" },
  { value: "documents", label: "Research and documents" },
  { value: "vision_understanding", label: "Screenshots, photos, or scanned PDFs" },
  { value: "image_generation", label: "Image generation" },
] as const;

export const INPUT_TYPE_OPTIONS = [
  { value: "text", label: "Just text" },
  { value: "pdf_text", label: "Documents or digital PDFs" },
  { value: "screenshots", label: "Screenshots or photos" },
  { value: "code", label: "Code files" },
  { value: "mixed", label: "A mix" },
] as const;

export const PDF_OPTIONS = [
  { value: "pdf_text", label: "Mostly selectable text" },
  { value: "pdf_scanned", label: "Mostly scanned pages or images" },
  { value: "both", label: "Both or not sure" },
] as const;
