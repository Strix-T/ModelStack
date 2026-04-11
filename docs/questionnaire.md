# Questionnaire Design

The questionnaire stays plain-English and adaptive:

- It asks for intended work, not model jargon.
- It splits digital PDFs from scanned PDFs because scanned pages imply a vision-capable stack.
- It derives `requiresEmbeddings`, `requiresVision`, and `requiresImageGeneration` from the normalized answers.

The questionnaire is reusable in two modes:

- interactive CLI use through `modelstack recommend` or `modelstack questionnaire`
- test fixtures that call the normalizer directly
