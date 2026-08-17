/**
 * The model as a graph of named tensors, derived entirely from `config.ts`.
 *
 * This is where correctness lives. Every shape, parameter count and byte figure
 * the visualization puts on screen is computed here, so all of it is checkable
 * by reading one file. Nothing downstream is allowed to hard-code a number that
 * could have been derived.
 *
 * THE GRAPH IS A TEMPLATE, NOT AN UNROLLING. There is one `block` subtree, not
 * 28 near-identical copies. The 28 blocks are structurally the same object and
 * only one is ever exploded at a time, so unrolling would buy 420 nodes of
 * duplication and nothing else. A node's layer index is carried by the focus
 * state, not by its id. `isPerLayer` marks the subtree that repeats, and
 * `totalParamsOf` is what multiplies by 28.
 *
 * IMPORTANT: this file must never import `three`. It is pulled in by the DOM
 * overlay, which is loaded eagerly. A value import of `three` here would hoist
 * three.js out of the lazy chunk and into the shared bundle.
 */

import { CONFIG } from "./config";

// ------------------------------------------------------------------ scalars

const {
  hiddenSize,
  intermediateSize,
  numHiddenLayers,
  numAttentionHeads,
  numKeyValueHeads,
  vocabSize,
  maxPositionEmbeddings,
  tieWordEmbeddings,
  attentionBias,
  bytesPerParam,
} = CONFIG;

const headDim = hiddenSize / numAttentionHeads;
const kvDim = numKeyValueHeads * headDim;
const groupSize = numAttentionHeads / numKeyValueHeads;

if (!Number.isInteger(headDim)) {
  throw new Error(`hiddenSize ${hiddenSize} is not divisible by ${numAttentionHeads} heads`);
}
if (!Number.isInteger(groupSize)) {
  throw new Error(`${numAttentionHeads} query heads do not group evenly over ${numKeyValueHeads} kv heads`);
}

/** Bias vectors on q/k/v. Qwen2 has them; most decoder-only models do not. */
const qBias = attentionBias ? hiddenSize : 0;
const kvBias = attentionBias ? kvDim : 0;

// -------------------------------------------------------------------- nodes

export type NodeKind =
  /** A container. Holds no tensor of its own; its parameters are its children's. */
  | "group"
  /** A parameter tensor. Loaded once, never changes, costs memory at rest. */
  | "weight"
  /** A transient tensor. Exists for one forward pass and is thrown away. */
  | "activation"
  /** An operation with no parameters: a mask, a softmax, an add. */
  | "op"
  /** The KV cache. The only thing here that is neither static nor transient. */
  | "cache";

/** A dimension is either a literal size or a symbolic name resolved at display
 *  time ("seq" is however many tokens are on screen). */
export type Dim = number | string;

export interface TensorNode {
  readonly id: string;
  /** Short display name. The inspector shows this; the index may override it. */
  readonly label: string;
  readonly kind: NodeKind;
  readonly parent: string | null;
  readonly shape: readonly Dim[];
  /** Parameters in this node alone, for ONE occurrence of it. Groups are 0;
   *  their children carry the weight. */
  readonly params: number;
  /** Set when this node's parameters are physically the same tensor as another
   *  node's, so they must be counted exactly once. */
  readonly tiedTo?: string;
}

/**
 * THERE IS NO `note` FIELD ANY MORE, and that is deliberate.
 *
 * Every node used to carry one or two sentences for the hover card, and the
 * detail panel showed them above a "Read more" that opened the real text in
 * `reading.ts`. Both were written about the same tensor, so the short one was
 * always a compressed restatement of the long one's first paragraph, and a
 * reader who wanted the answer had to ask twice to get it. The panel now shows
 * the writing directly. ONE PLACE FOR PROSE, which is `reading.ts`, and this
 * file is shapes and counts again.
 */

/**
 * Declared in dataflow order. Layout reads this order, so moving a line here
 * moves a box in the scene.
 */
export const NODES: readonly TensorNode[] = [
  {
    id: "tokens",
    label: "Tokens",
    kind: "activation",
    parent: null,
    shape: ["seq"],
    params: 0,
  },
  {
    id: "embed",
    label: "Token embedding",
    kind: "weight",
    parent: null,
    shape: [vocabSize, hiddenSize],
    params: vocabSize * hiddenSize,
  },
  {
    id: "stream",
    label: "Residual stream",
    kind: "activation",
    parent: null,
    shape: ["seq", hiddenSize],
    params: 0,
  },

  // ------------------------------------------------------------ the block
  {
    id: "block",
    label: "Transformer block",
    kind: "group",
    parent: null,
    shape: [],
    params: 0,
  },
  {
    id: "block.ln1",
    label: "RMSNorm",
    kind: "weight",
    parent: "block",
    shape: [hiddenSize],
    params: hiddenSize,
  },

  {
    id: "block.attn",
    label: "Attention",
    kind: "group",
    parent: "block",
    shape: [],
    params: 0,
  },
  {
    /**
     * THE THREE PROJECTIONS AS ONE STATION.
     *
     * It exists because the scene already groups them: `block.attn.qkv` is a
     * `Scope` in `attention.tsx` and an entry in the index, so it was a place a
     * reader could BE with nothing in the graph to describe it, and the card
     * went blank exactly there. Every scope path is now a node id.
     *
     * Reparenting q, k and v under it changes no arithmetic: `paramsOf` sums a
     * subtree, so attention's total is what it always was.
     */
    id: "block.attn.qkv",
    label: "Q, K, V projections",
    kind: "group",
    parent: "block.attn",
    shape: [],
    params: 0,
  },
  {
    id: "block.attn.q",
    label: "Q projection",
    kind: "weight",
    parent: "block.attn.qkv",
    shape: [hiddenSize, numAttentionHeads * headDim],
    params: hiddenSize * numAttentionHeads * headDim + qBias,
  },
  {
    id: "block.attn.k",
    label: "K projection",
    kind: "weight",
    parent: "block.attn.qkv",
    shape: [hiddenSize, kvDim],
    params: hiddenSize * kvDim + kvBias,
  },
  {
    id: "block.attn.v",
    label: "V projection",
    kind: "weight",
    parent: "block.attn.qkv",
    shape: [hiddenSize, kvDim],
    params: hiddenSize * kvDim + kvBias,
  },
  {
    id: "block.attn.rope",
    label: "RoPE",
    kind: "op",
    parent: "block.attn",
    shape: ["seq", headDim],
    params: 0,
  },
  {
    /**
     * A RESHAPE, NOT A COMPUTATION, and it has a node for the same reason
     * `block.attn.qkv` does: the index sends you here, so something has to
     * describe it. No parameters and no arithmetic; what happens is that the
     * projections' output is read as heads.
     */
    id: "block.attn.heads",
    label: "Heads",
    kind: "op",
    parent: "block.attn",
    shape: [numAttentionHeads, "seq", headDim],
    params: 0,
  },
  {
    id: "block.attn.scores",
    label: "Scores",
    kind: "activation",
    parent: "block.attn",
    shape: [numAttentionHeads, "seq", "seq"],
    params: 0,
  },
  {
    id: "block.attn.mask",
    label: "Causal mask",
    kind: "op",
    parent: "block.attn",
    shape: ["seq", "seq"],
    params: 0,
  },
  {
    id: "block.attn.softmax",
    label: "Softmax",
    kind: "op",
    parent: "block.attn",
    shape: [numAttentionHeads, "seq", "seq"],
    params: 0,
  },
  {
    id: "block.attn.context",
    label: "Attention output",
    kind: "activation",
    parent: "block.attn",
    shape: [numAttentionHeads, "seq", headDim],
    params: 0,
  },
  {
    id: "block.attn.o",
    label: "Output projection",
    kind: "weight",
    parent: "block.attn",
    shape: [numAttentionHeads * headDim, hiddenSize],
    params: numAttentionHeads * headDim * hiddenSize,
  },

  {
    id: "block.add1",
    label: "Residual add",
    kind: "op",
    parent: "block",
    shape: ["seq", hiddenSize],
    params: 0,
  },
  {
    id: "block.ln2",
    label: "RMSNorm",
    kind: "weight",
    parent: "block",
    shape: [hiddenSize],
    params: hiddenSize,
  },

  {
    id: "block.mlp",
    label: "SwiGLU MLP",
    kind: "group",
    parent: "block",
    shape: [],
    params: 0,
  },
  {
    id: "block.mlp.gate",
    label: "Gate projection",
    kind: "weight",
    parent: "block.mlp",
    shape: [hiddenSize, intermediateSize],
    params: hiddenSize * intermediateSize,
  },
  {
    id: "block.mlp.up",
    label: "Up projection",
    kind: "weight",
    parent: "block.mlp",
    shape: [hiddenSize, intermediateSize],
    params: hiddenSize * intermediateSize,
  },
  {
    id: "block.mlp.swiglu",
    label: "SiLU gate",
    kind: "op",
    parent: "block.mlp",
    shape: ["seq", intermediateSize],
    params: 0,
  },
  {
    id: "block.mlp.down",
    label: "Down projection",
    kind: "weight",
    parent: "block.mlp",
    shape: [intermediateSize, hiddenSize],
    params: intermediateSize * hiddenSize,
  },

  {
    id: "block.add2",
    label: "Residual add",
    kind: "op",
    parent: "block",
    shape: ["seq", hiddenSize],
    params: 0,
  },

  // -------------------------------------------------------------- the ends
  {
    id: "norm_f",
    label: "Final norm",
    kind: "weight",
    parent: null,
    shape: [hiddenSize],
    params: hiddenSize,
  },
  {
    id: "lm_head",
    label: "LM head",
    kind: "weight",
    parent: null,
    shape: [vocabSize, hiddenSize],
    // Tied: physically the same tensor as `embed`, so it costs zero additional
    // parameters. Counting it twice would inflate the model by 233M, 15% of it.
    params: tieWordEmbeddings ? 0 : vocabSize * hiddenSize,
    tiedTo: tieWordEmbeddings ? "embed" : undefined,
  },
  {
    id: "logits",
    label: "Logits",
    kind: "activation",
    parent: null,
    shape: ["seq", vocabSize],
    params: 0,
  },
  {
    id: "sample",
    label: "Sampling",
    kind: "op",
    parent: null,
    shape: [1],
    params: 0,
  },

  // ------------------------------------------------------------- the cache
  {
    id: "kv",
    label: "KV cache",
    kind: "cache",
    parent: null,
    shape: [numHiddenLayers, 2, numKeyValueHeads, "seq", headDim],
    params: 0,
  },
];

// ------------------------------------------------------------------ lookups

const BY_ID = new Map(NODES.map((n) => [n.id, n]));

export function nodeById(id: string): TensorNode | undefined {
  return BY_ID.get(id);
}

export function childrenOf(id: string | null): TensorNode[] {
  return NODES.filter((n) => n.parent === id);
}

export function ancestorsOf(id: string): string[] {
  const out: string[] = [];
  let cur = BY_ID.get(id)?.parent ?? null;
  while (cur) {
    out.push(cur);
    cur = BY_ID.get(cur)?.parent ?? null;
  }
  return out;
}

/** True for the `block` subtree: the part that exists once per layer. */
export function isPerLayer(id: string): boolean {
  return id === "block" || ancestorsOf(id).includes("block");
}

/** Parameters in a node and everything under it, for ONE occurrence. */
export function paramsOf(id: string): number {
  const node = BY_ID.get(id);
  if (!node) return 0;
  return childrenOf(id).reduce((sum, c) => sum + paramsOf(c.id), node.params);
}

/** Parameters this node contributes to the whole model, i.e. multiplied by the
 *  layer count when it lives inside a block. */
export function totalParamsOf(id: string): number {
  return paramsOf(id) * (isPerLayer(id) ? numHiddenLayers : 1);
}

export function bytesOf(id: string): number {
  return totalParamsOf(id) * bytesPerParam;
}

// ----------------------------------------------------------------- derived

const paramsPerBlock = paramsOf("block");
const paramsAllBlocks = paramsPerBlock * numHiddenLayers;
const paramsAttnPerBlock = paramsOf("block.attn");
const paramsMlpPerBlock = paramsOf("block.mlp");
const paramsEmbed = paramsOf("embed");
const paramsTotal = NODES.filter((n) => n.parent === null).reduce(
  (sum, n) => sum + totalParamsOf(n.id),
  0
);

/** Bytes of KV cache per token of context, across every layer.
 *
 *  Two tensors (K and V), one per layer, each `kvDim` wide. This is the number
 *  that decides how many sequences fit on a GPU, and it is the reason grouped
 *  query attention exists. */
const kvBytesPerToken = 2 * numHiddenLayers * kvDim * bytesPerParam;

/** What the same cache would cost without GQA, i.e. if every query head had its
 *  own K and V. The ratio is exactly `groupSize`. */
const kvBytesPerTokenMha = 2 * numHiddenLayers * hiddenSize * bytesPerParam;

export const DERIVED = Object.freeze({
  headDim,
  kvDim,
  /** Query heads per key/value head. */
  groupSize,

  paramsPerBlock,
  paramsAllBlocks,
  paramsAttnPerBlock,
  paramsMlpPerBlock,
  paramsEmbed,
  paramsTotal,
  /** What model cards mean by "non-embedding parameters". */
  paramsNonEmbedding: paramsTotal - paramsEmbed,

  weightBytes: paramsTotal * bytesPerParam,

  /** Fractions, 0..1. These are the facts the geometry is supposed to make
   *  visible, so they are computed rather than asserted. */
  mlpShareOfBlock: paramsMlpPerBlock / paramsPerBlock,
  mlpShareOfModel: (paramsMlpPerBlock * numHiddenLayers) / paramsTotal,
  attnShareOfModel: (paramsAttnPerBlock * numHiddenLayers) / paramsTotal,
  embedShareOfModel: paramsEmbed / paramsTotal,

  kvBytesPerToken,
  kvBytesPerTokenMha,
  kvBytesAtMaxContext: kvBytesPerToken * maxPositionEmbeddings,
});
