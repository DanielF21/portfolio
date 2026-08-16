/**
 * Qwen2.5-1.5B, exactly as the model ships it.
 *
 * This file holds the config and NOTHING else. Every number the visualization
 * shows is derived from these fields in `model.ts`, so there is exactly one
 * place a wrong number could come from, and it is a file you can diff against
 * huggingface.co/Qwen/Qwen2.5-1.5B/raw/main/config.json.
 *
 * Nothing here is rounded, chosen for looks, or filled in from memory. If a
 * field is not in the real config it does not belong in this file.
 *
 * IMPORTANT: this file must never import `three`. It is pulled in by the DOM
 * overlay, which is loaded eagerly. A value import of `three` here would hoist
 * three.js out of the lazy chunk and into the shared bundle.
 */

export interface ModelConfig {
  readonly name: string;
  readonly hiddenSize: number;
  readonly intermediateSize: number;
  readonly numHiddenLayers: number;
  readonly numAttentionHeads: number;
  readonly numKeyValueHeads: number;
  readonly vocabSize: number;
  readonly maxPositionEmbeddings: number;
  readonly ropeTheta: number;
  readonly rmsNormEps: number;
  /** Qwen2 ties lm_head to the input embedding, so those weights are ONE
   *  tensor and must be counted once. Getting this wrong inflates the
   *  parameter count by 233M, which is 15% of the model. */
  readonly tieWordEmbeddings: boolean;
  /** Qwen2 puts a bias on q/k/v and none on o. Unusual enough to be worth
   *  naming rather than assuming. */
  readonly attentionBias: boolean;
  readonly dtype: "bfloat16";
  /** Bytes per stored parameter at the dtype above. */
  readonly bytesPerParam: number;
}

export const QWEN2_5_1_5B: ModelConfig = Object.freeze({
  name: "Qwen2.5-1.5B",
  hiddenSize: 1536,
  intermediateSize: 8960,
  numHiddenLayers: 28,
  numAttentionHeads: 12,
  numKeyValueHeads: 2,
  vocabSize: 151936,
  maxPositionEmbeddings: 131072,
  ropeTheta: 1000000.0,
  rmsNormEps: 1e-6,
  tieWordEmbeddings: true,
  attentionBias: true,
  dtype: "bfloat16",
  bytesPerParam: 2,
});

/** The model the visualization is currently built around. Single point of
 *  change if a second config is ever added. */
export const CONFIG = QWEN2_5_1_5B;
