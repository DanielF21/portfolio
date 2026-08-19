/**
 * The long form text, opened by "Read more" in the detail panel.
 *
 * WHY IT IS A SEPARATE FILE. `model.ts` is the graph: shapes, parameter counts,
 * bytes, and one line per node saying what the thing is. That one line has a job
 * and a size, because it is what the panel shows about whatever the cursor is
 * on, and it is read at a glance while moving. Everything longer lives here,
 * behind a press, and nothing here is loaded into the scene.
 *
 * HOUSE STYLE, and it is not this codebase's. The prose is written the way
 * Philip Kiely writes Inference Engineering: a definition first, then what the
 * thing costs, then why an inference engineer cares. Short declarative
 * sentences. Real numbers rather than adjectives. No metaphors, and no
 * enthusiasm the subject has not earned. Where the book states a general fact
 * about serving (decode is memory bound, prefill is compute bound, attention is
 * the optimization target) this text states it the same way.
 *
 * EVERY FIGURE IS INTERPOLATED, NEVER TYPED. Same rule the geometry follows: the
 * numbers come out of `CONFIG` and `DERIVED`, so prose and picture cannot
 * disagree, and swapping the config rewrites the writing. A sentence that had to
 * be re-checked by hand against a config file is a sentence that will one day be
 * wrong.
 *
 * IMPORTANT: this file must never import `three`. It is pulled in by the DOM
 * overlay, which is loaded eagerly.
 */

import { CONFIG } from "./config";
import {
  formatBytes,
  formatCount,
  formatInt,
  formatPercent,
  formatRatio,
} from "./format";
import { OVERVIEW_ID } from "./glossary";
import { DERIVED, paramsOf } from "./model";

/** A bulleted term, the book's own device for naming the parts of a thing. */
export interface ReadingPoint {
  readonly term: string;
  readonly text: string;
}

/** A paragraph, or a list of them. Rendered in order. */
export type ReadingBlock = string | { readonly points: readonly ReadingPoint[] };

export interface Reading {
  readonly body: readonly ReadingBlock[];
}

const {
  hiddenSize,
  intermediateSize,
  numHiddenLayers,
  numAttentionHeads,
  numKeyValueHeads,
  vocabSize,
  maxPositionEmbeddings,
  ropeTheta,
  dtype,
} = CONFIG;

const { headDim, kvDim, groupSize } = DERIVED;

// Shorthands, so a sentence reads as a sentence rather than as a template.
const H = formatInt(hiddenSize);
const I = formatInt(intermediateSize);
const V = formatInt(vocabSize);
const D = formatInt(headDim);
const KVD = formatInt(kvDim);
const L = formatInt(numHiddenLayers);
const NQ = formatInt(numAttentionHeads);
const NKV = formatInt(numKeyValueHeads);
const GQA = formatInt(groupSize);

const mlpPerBlock = paramsOf("block.mlp");
const attnPerBlock = paramsOf("block.attn");
const qParams = paramsOf("block.attn.q");
const kParams = paramsOf("block.attn.k");
const gateParams = paramsOf("block.mlp.gate");

/**
 * RMSNorm is written once and used three times.
 *
 * The model has three of them and they are the same operation on the same
 * number of parameters; three near identical essays would only invite one of
 * them to drift. The differences that matter are in each one's `note`.
 */
const NORM_BODY: readonly ReadingBlock[] = [
  `RMSNorm divides every token's vector by its own root mean square, then multiplies it channel by channel by a learned gain. The gain is one number per channel, so the whole layer is ${H} parameters.`,
  `It is a rounding error in the size of the model and it is not optional. ${L} blocks add their output into the same residual stream, and without a rescale in front of each sublayer those magnitudes compound. Normalizing before the sublayer rather than after it is what makes a stack this deep stable.`,
  `For inference it is a fusion target rather than a cost. A norm reads and writes an entire activation to do very little arithmetic, which is the definition of a memory bound kernel, so engines fold it into the matmul next to it instead of launching it on its own.`,
];

const READING: Record<string, Reading> = {
  /**
   * The whole model, and the panel's resting state.
   *
   * THE ONE ENTRY WITH NO TENSOR BEHIND IT. Every other key here is a node id;
   * this one is the index's overview, which is not a thing in the model but all
   * of them. It exists because the panel is permanent furniture now and has to
   * say something before anyone has pointed at anything, and "point at
   * something" is not what a reader arriving at a diagram wants to be told.
   */
  [OVERVIEW_ID]: {
    body: [
      `${CONFIG.name} is an embedding, ${L} transformer blocks, and the embedding again transposed. An LLM is a stack of identical transformer blocks with an input layer in front and an output layer behind. Tokens come in as integers, are looked up as vectors, are edited ${L} times by blocks that each read the residual stream and add back into it, and leave as one score per vocabulary entry.`,
      `${formatCount(DERIVED.paramsTotal)} parameters at ${dtype} is ${formatBytes(DERIVED.weightBytes)} of weights. ${formatCount(DERIVED.paramsNonEmbedding)} of that is the blocks; the rest is the embedding, which Qwen ties to the output layer and therefore reads at both ends of the pass.`,
      `Every forward pass through it belongs to one of two phases, and they behave nothing alike:`,
      {
        points: [
          {
            term: "Prefill",
            text: "Processes the whole input sequence at once and fills the KV cache. Compute bound, and it sets time to first token.",
          },
          {
            term: "Decode",
            text: "One forward pass per output token, reading every weight to produce one. Memory bound, and it sets tokens/s.",
          },
        ],
      },
      `The weights are only half of what has to fit in GPU memory. The other half is the KV cache, which is a fixed ${formatBytes(DERIVED.kvBytesPerToken)} per token of context per request, and unlike the weights it grows with traffic.`,
    ],
  },

  // ------------------------------------------------------------ the input
  tokens: {
    body: [
      `A language model does not read text. It reads tokens: integers that index a fixed vocabulary of ${V} strings, each one a common word, a fragment of a less common word, or a punctuation mark.`,
      `Tokenization is a lookup rather than a neural network. The tokenizer ships with the model, and converting between strings and ids costs nothing measurable next to a forward pass.`,
      `It still decides what inference costs. Latency and price are quoted per token everywhere in this industry, so a tokenizer that spends fewer tokens on the same text produces a faster and cheaper request end to end, before any engine has been optimized.`,
    ],
  },

  embed: {
    body: [
      `The embedding is the input layer of the network. It holds one row of ${H} numbers for each of the ${V} entries in the vocabulary, and turning a token into a vector is a row lookup, not a matrix multiply.`,
      `At ${formatCount(DERIVED.paramsEmbed)} parameters it is the largest single tensor in the model and ${formatPercent(DERIVED.embedShareOfModel)} of its weights. That is why model cards quote a non embedding parameter count separately: ${formatCount(DERIVED.paramsNonEmbedding)} of this model does the work of a language model and the rest is a dictionary.`,
      `Qwen ties this tensor to the output layer, so the same weights are used twice in a forward pass. Once at the start, by index, and once at the end as a matmul against the vocabulary.`,
    ],
  },

  stream: {
    body: [
      `The residual stream is the model's working state: one vector of ${H} numbers per token, carried from the embedding to the output layer. Every block reads it, computes on a copy, and adds the result back. Nothing along the way replaces it.`,
      `Its width is the hidden size, and that single number sets the shape of nearly every weight in the model. Each projection in a block reads ${H} channels or writes them, which is why the attention and MLP weights all share an axis.`,
      `During decode the stream holds one token at a time: ${H} values, a few kilobytes. The weights it is multiplied against are ${formatBytes(DERIVED.weightBytes)}. That imbalance between work and memory traffic is the reason decode is memory bound, and it is the reason batching helps so much, since a batch reuses one weight read across many streams.`,
    ],
  },

  // ------------------------------------------------------------- the block
  block: {
    body: [
      `The repeating unit of an LLM, and the same six steps every time: normalize, attend, add, normalize, mix, add. This model has ${L} of them, each holding ${formatCount(DERIVED.paramsPerBlock)} parameters, ${formatCount(DERIVED.paramsAllBlocks)} in total.`,
      {
        points: [
          {
            term: "Attention sublayer",
            text: `Relates each token to the tokens before it. ${formatCount(attnPerBlock)} parameters per block.`,
          },
          {
            term: "Feed forward sublayer",
            text: `A SwiGLU multi layer perceptron. ${formatCount(mlpPerBlock)} parameters per block, ${formatPercent(DERIVED.mlpShareOfBlock)} of it.`,
          },
          {
            term: "Normalization",
            text: `Two RMSNorms, one before each sublayer, ${formatInt(hiddenSize * 2)} parameters between them.`,
          },
        ],
      },
      `Blocks are where architecture support in an inference engine actually lives. Engines are written against a block structure rather than against a model, so a deployment tuned for one Qwen2 model runs every other model of the same architecture at the same speed.`,
    ],
  },

  // The three norms share a body and differ by one opening line, which is the
  // only thing that differs about them: same operation, same parameter count,
  // different position in the pass.
  "block.ln1": {
    body: ["The first of the block's two norms, in front of attention.", ...NORM_BODY],
  },
  "block.ln2": {
    body: [
      "The second of the block's two norms, in front of the feed forward network, which is the larger of the two computations it protects.",
      ...NORM_BODY,
    ],
  },
  norm_f: {
    body: [
      `The last norm in the model, after all ${L} blocks and before the output layer. Everything the stack accumulated is rescaled once more before it becomes logits.`,
      ...NORM_BODY,
    ],
  },

  // --------------------------------------------------------- attention
  "block.attn": {
    body: [
      `Attention is how a transformer relates one token to the others in the sequence. In the sentence "I decided to write a book because I thought it would be easy", attention is what connects "it" to writing a book.`,
      `The operation is scaled dot product attention over three projections of the same input: queries for the token being generated, keys for everything it can look at, and values for what it takes away. Every query is compared against every key, so the work grows with the square of the sequence length.`,
      `It holds ${formatCount(attnPerBlock)} parameters per block against the feed forward network's ${formatCount(mlpPerBlock)}, which makes it the smaller half of the weights and by far the larger half of the engineering. Attention is the most expensive operation in both phases of inference and the one that almost every optimization in the field, from FlashAttention to paged KV cache, is aimed at.`,
    ],
  },

  "block.attn.qkv": {
    body: [
      `Attention takes three inputs, and all three are linear projections of the same normalized stream.`,
      {
        points: [
          { term: "Q, queries", text: "The representation of the token being generated or updated." },
          { term: "K, keys", text: "Representations of every prior token, matched against the query." },
          { term: "V, values", text: "What attention returns for the tokens a query matched." },
        ],
      },
      `The three are not the same size. Q projects to ${formatInt(numAttentionHeads * headDim)} channels, ${NQ} heads of ${D}, while K and V project to ${KVD}, only ${NKV} heads. That is grouped query attention: ${GQA} query heads share one key value head.`,
      `The asymmetry is a memory decision. Q is recomputed for one token at a time and thrown away; K and V are kept for every token in the context, so their width is multiplied by the sequence length and by ${L} layers. Narrowing them by ${formatRatio(groupSize)} narrows the KV cache by the same factor, at a quality cost small enough that nearly every model released since 2023 takes the trade.`,
    ],
  },

  "block.attn.q": {
    body: [
      `The query projection reads ${H} channels and writes ${formatInt(numAttentionHeads * headDim)}, read as ${NQ} heads of ${D}. A query is the token asking what it should attend to.`,
      `It is ${formatCount(qParams)} parameters per block, including the bias Qwen2 puts on q, k and v and most architectures leave off.`,
      `Queries are never cached. During decode only the newest token has a query, which is exactly why a decode step is a vector times a matrix rather than a matrix times a matrix, and why it is bound by the speed of reading weights rather than by arithmetic.`,
    ],
  },

  "block.attn.k": {
    body: [
      `The key projection reads ${H} channels and writes ${KVD}, read as ${NKV} heads of ${D}. Keys are what queries are compared against.`,
      `At ${formatCount(kParams)} parameters it is a sixth the size of the query projection, and that ratio is grouped query attention: each key head is shared by ${GQA} query heads.`,
      `Keys are half of the KV cache. Every token processed leaves ${KVD} numbers per layer behind, and they stay for as long as the request lives.`,
    ],
  },

  "block.attn.v": {
    body: [
      `The value projection has the same shape as the key projection, ${H} in and ${KVD} out, and the same ${formatCount(kParams)} parameters. Values are what attention actually returns, weighted by the scores.`,
      `Keys and values are stored together and always for the same tokens, which is why the cache is quoted as one number: ${formatBytes(DERIVED.kvBytesPerToken)} per token across all ${L} layers of this model, at ${dtype}.`,
    ],
  },

  "block.attn.rope": {
    body: [
      `Attention has no idea what order its inputs arrive in. Every score is a dot product between a query and a key, and dot products do not care where either one came from. Position has to be put in by hand.`,
      `Rotary position embedding does it by rotating each pair of dimensions in Q and K through an angle proportional to the token's index, with the rate of rotation set by the base ${formatInt(ropeTheta)}. Because the rotation is applied before the dot product, what survives into the score is the difference between two positions rather than either one on its own.`,
      `There are no parameters here and almost no cost. What RoPE does affect is context length: this model is configured for ${formatInt(maxPositionEmbeddings)} positions, and the common techniques for extending a model past what it was trained on, like position interpolation and YaRN, are all rescalings of these angles rather than new weights.`,
    ],
  },

  "block.attn.heads": {
    body: [
      `Attention is multi head: the projection output is read as several independent attention operations side by side, each over ${D} channels. Different heads end up responsible for different kinds of relationship, like subject verb agreement or working out what a pronoun refers to.`,
      `This model has ${NQ} query heads and only ${NKV} key value heads, so each key and value head is shared by ${GQA} queries. The three named points on that spectrum are worth knowing:`,
      {
        points: [
          { term: "Multi head attention", text: "One key value head per query head. The original design, and the largest cache." },
          { term: "Grouped query attention", text: `Several query heads share a key value head. What this model does, at ${GQA} to 1.` },
          { term: "Multi query attention", text: "One key value head for all queries. The smallest cache, and the largest quality risk." },
        ],
      },
      `The reshape itself is free, no parameters and no arithmetic. The saving is entirely in memory: ${formatBytes(DERIVED.kvBytesPerToken)} per token here against ${formatBytes(DERIVED.kvBytesPerTokenMha)} without sharing.`,
    ],
  },

  "block.attn.scores": {
    body: [
      `The score matrix is Q times K transpose, scaled by one over the square root of ${D}, giving one number for every pair of positions in every head. That scale factor keeps the values in a range where softmax does not saturate.`,
      `This is the quadratic part of a transformer. Doubling the sequence length doubles the work everywhere else in the model and quadruples it here, which is why long context is an attention problem rather than a parameter count problem.`,
      `A naive implementation writes the whole matrix to GPU memory and reads it straight back for the softmax. FlashAttention exists because that traffic, not the arithmetic, is the bottleneck: it computes the scores in tiles inside on chip memory and never materializes the full matrix at all. Every serious engine uses some version of it.`,
    ],
  },

  "block.attn.mask": {
    body: [
      `The causal mask removes every score above the diagonal before the softmax, so a token can attend to itself and to the tokens before it and to nothing else. This is what "causal language model" means, and it is why the architecture name ends in CausalLM.`,
      `It is also the reason the KV cache is correct. Because no earlier token can ever attend to a later one, the keys and values computed for token five are still valid when token six arrives, so they can be stored once and reused for the rest of the request.`,
      `In a good kernel the mask is not a matrix that gets multiplied in. Tiles entirely above the diagonal are skipped rather than computed and discarded.`,
    ],
  },

  "block.attn.softmax": {
    body: [
      `Softmax normalizes each row of the score matrix so it sums to one. The row is then a set of weights: how much of each previous token's value this token takes.`,
      `Implementations subtract the row maximum first, because exponentiating raw scores overflows. That detail is why the operation is done in a single fused pass in practice rather than as three separate kernels, and it is the part of FlashAttention that took work: the running maximum has to be corrected as new tiles arrive.`,
    ],
  },

  "block.attn.context": {
    body: [
      `Once the rows are distributions, attention multiplies them by V. The result is one vector of ${D} numbers per head per token: a blend of the values of the tokens this one decided to look at.`,
      `The ${NQ} head outputs are concatenated back to ${formatInt(numAttentionHeads * headDim)} channels, which is the stream's width again, and handed to the output projection.`,
    ],
  },

  "block.attn.o": {
    body: [
      `The heads compute independently, and something has to let them interact. The output projection concatenates all ${NQ} of them and multiplies by a ${formatInt(numAttentionHeads * headDim)} by ${H} matrix, which is what mixes their results before the answer is added back to the stream.`,
      `It is the same shape as the query projection transposed and holds the same ${formatCount(paramsOf("block.attn.o"))} parameters. Unlike q, k and v it carries no bias, which is Qwen2's own choice and the sort of detail an engine has to get right per architecture.`,
    ],
  },

  "block.add1": {
    body: [
      `A residual add is exactly what it sounds like: the sublayer's output is added to the input it read. Nothing is overwritten, so the stream accumulates edits from ${L} blocks in turn.`,
      `It has no parameters and costs one pass over the activation. What it buys is depth: a block that has learned nothing useful for a given token can contribute close to nothing rather than corrupting what came before, which is what allows stacks of dozens to hundreds of blocks to work at all.`,
    ],
  },
  "block.add2": {
    body: [
      `The second residual add closes the block. Read, compute, add, twice per block: once around attention and once around the feed forward network.`,
      `The output of this add is the input to the next block's first norm, unchanged, which is what makes the residual stream a single continuous object rather than ${L} separate ones.`,
    ],
  },

  // ---------------------------------------------------------------- the MLP
  "block.mlp": {
    body: [
      `The feed forward network is a multi layer perceptron: a projection up to a wider intermediate size, a nonlinearity, and a projection back down. Qwen uses the SwiGLU variant, which splits the widening in two so one half can gate the other.`,
      {
        points: [
          { term: "Gate and up", text: `Two separate projections from ${H} to ${I}, each ${formatCount(gateParams)} parameters.` },
          { term: "SiLU and multiply", text: "The gate is passed through SiLU and multiplied elementwise into up." },
          { term: "Down", text: `One projection back from ${I} to ${H}, the same ${formatCount(gateParams)} parameters again.` },
        ],
      },
      `That is ${formatCount(mlpPerBlock)} per block, ${formatPercent(DERIVED.mlpShareOfBlock)} of the block and ${formatPercent(DERIVED.mlpShareOfModel)} of the whole model. Linear sublayers being the majority of the weights is true of every dense transformer, and it is precisely what Mixture of Experts changes: replace one wide matrix with many narrow ones and route each token to a few of them.`,
      `Three large matmuls per token per layer, with no dependence between tokens. At prefill that is dense compute and it saturates the GPU. At decode it is a vector against a matrix, so the time goes into reading ${formatBytes(mlpPerBlock * CONFIG.bytesPerParam)} of weights per block, not into the arithmetic.`,
    ],
  },

  "block.mlp.gate": {
    body: [
      `Gate projects the normalized stream from ${H} channels to ${I}. Its output does not continue on its own: it is passed through SiLU and used to scale the up projection elementwise.`,
      `${formatCount(gateParams)} parameters, identical in shape and cost to up. A SwiGLU network pays for two widening projections instead of one, which is why the intermediate size of a gated model is usually smaller than the four times hidden size that ungated feed forward networks use.`,
    ],
  },
  "block.mlp.up": {
    body: [
      `Up is the same shape as gate, ${H} in and ${I} out, and the same ${formatCount(gateParams)} parameters. The difference is only what happens next: gate goes through the activation function, up is what the activation multiplies.`,
      `The two are computed from the same input, so engines usually fuse them into one matmul of twice the width and split the result afterwards. One weight read instead of two.`,
    ],
  },
  "block.mlp.swiglu": {
    body: [
      `An activation function is what stops a stack of linear layers collapsing into a single matrix multiply. SwiGLU is a gated one: SiLU is applied to the gate projection, and the result is multiplied elementwise into the up projection.`,
      `No parameters, and it is elementwise, so it does almost no arithmetic per byte it touches. Left as its own kernel it would read and write ${I} values per token for nothing, which is why it is fused into the projection on one side or the other.`,
    ],
  },
  "block.mlp.down": {
    body: [
      `Down projects the gated ${I} channel intermediate back to the stream's ${H}, and the result is what gets added into the residual stream.`,
      `Its ${formatCount(gateParams)} parameters are the same count as gate and up with the axes the other way round. All three are the same size because a parameter count is the product of two dimensions and the same two dimensions appear in each.`,
    ],
  },

  // ------------------------------------------------------------- the output
  lm_head: {
    body: [
      `The language modeling head is the last layer of the network. It multiplies the final hidden state by a ${V} by ${H} matrix, producing one score for every entry in the vocabulary.`,
      `Qwen ties it to the token embedding, so it is not a second tensor: it is the same ${formatCount(DERIVED.paramsEmbed)} weights read transposed. Counting them twice would overstate the model by ${formatPercent(DERIVED.embedShareOfModel)}.`,
      `At decode only the last position needs this. One vector against a matrix of ${formatBytes(DERIVED.paramsEmbed * CONFIG.bytesPerParam)}, once per generated token, which makes the output layer one of the larger single weight reads in a decode step even though it is one matmul.`,
    ],
  },

  logits: {
    body: [
      `The network's output is a vector of ${V} logits, one per token in the vocabulary. They are raw scores, not probabilities, until they have been normalized.`,
      `Sampling controls act at two different moments here, and the order matters: temperature scales the logits before normalization, while top-k and top-p select among them afterwards. Logit biasing and constrained decoding also act at this point, which is how structured output like JSON is enforced without any change to the model.`,
    ],
  },

  sample: {
    body: [
      `A forward pass produces a vector, and a language model has to produce a token. Softmax turns the logits into probabilities and one token is drawn from that distribution.`,
      {
        points: [
          { term: "Temperature", text: "Scales the logits before normalization. Lower is more predictable." },
          { term: "Top-k", text: "Keeps the k most likely tokens and renormalizes among them." },
          { term: "Top-p", text: "Keeps the smallest set of tokens whose probabilities sum to p." },
        ],
      },
      `Temperature 0 or top-k 1 makes selection deterministic, always the highest scoring token. The chosen token is appended to the sequence and fed back in, and the loop runs again until the model emits its stop token or hits a length limit.`,
    ],
  },

  // -------------------------------------------------------------- the cache
  kv: {
    body: [
      `Attention needs the keys and values of every previous token on every step. Recomputing them each time would make generation quadratic in the length of the output, so they are computed once and stored. That store is the KV cache: built during prefill, extended by one column per token during decode, and held in GPU memory next to the weights.`,
      `The arithmetic is small enough to do by hand. One token needs K and V for each of ${L} layers at ${KVD} channels each, two bytes per value at ${dtype}, which is ${formatBytes(DERIVED.kvBytesPerToken)} per token. At this model's full ${formatInt(maxPositionEmbeddings)} token context that is ${formatBytes(DERIVED.kvBytesAtMaxContext)} for a single request. Without grouped query attention it would be ${formatRatio(DERIVED.kvBytesPerTokenMha / DERIVED.kvBytesPerToken)} that.`,
      `The cache is the reason the two phases of inference behave so differently. Prefill computes every column at once and is compute bound; decode adds one column per forward pass, reading the whole model to produce a single token, and is memory bound.`,
      `It is also the resource that decides how many requests fit on a GPU. Weights are a fixed cost, but cache grows with every concurrent request and every token of context, so most of what an inference engine does about memory is really about this array: paged attention to stop it fragmenting, prefix caching to avoid rebuilding shared prompts, and cache aware routing to send a request to a replica that already holds its prefix.`,
    ],
  },
};

export function readingFor(id: string): Reading | undefined {
  return READING[id];
}
