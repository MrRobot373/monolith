---
name: ai-ml
description: Build and evaluate ML and LLM features - data prep, training, evaluation, prompts, RAG, agents, deployment. Use for model work, prompt engineering, retrieval systems and judging whether an AI feature actually works.
whenToUse: The task involves a machine learning model, an LLM feature, retrieval, or evaluating either.
metadata:
  category: engineering
  version: 1.0.0
  license: MIT
---

# ML and LLM features

## Decide how you will measure before you build

An AI feature without an evaluation is a demo. Before writing the pipeline,
answer: what does correct look like, on what examples, scored how?

Build a small labelled set - 50 real, hard, representative examples beats 5,000
synthetic ones. Include the cases you expect to fail.

## Data before model

Most bad results are bad data.

- Look at the raw rows. Print twenty and read them.
- Check leakage: any feature that would not exist at prediction time makes the
  offline score a lie.
- Split by the unit that matters - user, session, time. A random row split
  leaks the same user into train and test and inflates every metric.
- Check class balance before trusting accuracy. 97% accuracy on a 97/3 split is
  a model that says "no".

## Metrics that mean something

| Task | Use | Not |
|---|---|---|
| Imbalanced classification | precision/recall, PR-AUC | accuracy |
| Ranking / retrieval | recall@k, MRR, nDCG | accuracy |
| Regression | MAE with the target's spread | R² alone |
| Generation | task-specific rubric on held-out cases | vibes |

Always report the baseline. A model that beats nothing is not a result -
compare against the trivial predictor or the current rule.

## LLM features

- **Prompt is code.** Version it, keep the eval set, re-run on every change.
- **Retrieval quality dominates.** If the right chunk is not retrieved, no
  prompt saves the answer. Measure retrieval separately from generation.
- **Structure the output** when it will be parsed, and validate it - a model
  will eventually return a near-miss shape.
- **Ground every factual claim** in retrieved context, and make "I don't know"
  an acceptable answer. An unhedged confident wrong answer is the expensive
  failure mode.
- Cost and latency are features. Measure tokens and p95 alongside quality.

## Honesty

Report the metric you measured, on the split you measured it on. Never present
a training-set score as performance. If the eval is thin, say how thin.

## Related

- `data-analysis` to explore the dataset
- `testing` for the deterministic parts, `backend-api` to serve it
