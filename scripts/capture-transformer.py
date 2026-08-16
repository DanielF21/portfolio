#!/usr/bin/env python3
"""
Capture one real forward pass of Qwen2.5-1.5B for the transformer visualization.

Writes public/things/transformer/capture.json, which the scene loads lazily.
Without it the scene still renders: the structure is drawn from the config and
the score grid falls back to a flat triangle. What the capture adds is REAL
attention, so the patterns on screen are patterns the model actually produced
rather than something invented to look plausible.

    pip install torch transformers
    python3 scripts/capture-transformer.py

That is roughly 2.5 GB of wheels and a 3.1 GB model download, so it is a
deliberate step rather than part of the build.

WHAT IS AND IS NOT CLAIMED. This is n=1: one prompt, one forward pass, one
model. It is enough to show that attention has structure and what that
structure looks like, and it is not enough to support "attention always does
X". The prompt is written into the file and shown on screen for exactly that
reason.

QUANTIZATION. Post-softmax attention is already in [0, 1], so each weight is
stored as a single byte, value * 255 rounded. At a 12 token prompt the typical
weight is around 0.08 and the smallest ones that matter are far above the 1/510
floor, so the loss is invisible. The array is [layer][head][query][key], packed
row major and base64'd: 28 * 12 * 12 * 12 = 48,384 bytes.
"""

import base64
import json
import os
import sys

MODEL = "Qwen/Qwen2.5-1.5B"

# Short, and deliberately containing a repeated name. Induction behaviour, where
# a head attends back to what followed this token last time, is the clearest
# structure a prompt this size can show.
PROMPT = "Ada met Bob. Ada waved at"

OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "public",
    "things",
    "transformer",
    "capture.json",
)


def main() -> int:
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError:
        print(
            "torch and transformers are required:\n"
            "    pip install torch transformers",
            file=sys.stderr,
        )
        return 1

    tok = AutoTokenizer.from_pretrained(MODEL)
    # eager, because the fused attention kernels do not materialise the weight
    # matrix and so cannot return it. This is slower and it is the whole point.
    model = AutoModelForCausalLM.from_pretrained(
        MODEL, torch_dtype=torch.float32, attn_implementation="eager"
    )
    model.eval()

    enc = tok(PROMPT, return_tensors="pt")
    ids = enc["input_ids"]
    seq = int(ids.shape[1])

    with torch.no_grad():
        out = model(**enc, output_attentions=True, output_hidden_states=True)

    cfg = model.config
    layers, heads = cfg.num_hidden_layers, cfg.num_attention_heads

    # attentions is a tuple of [batch, heads, q, k] per layer.
    assert len(out.attentions) == layers, "layer count disagrees with the config"
    flat = bytearray()
    for layer in out.attentions:
        a = layer[0]  # drop batch
        assert a.shape == (heads, seq, seq), f"unexpected attention shape {a.shape}"
        b = (a.clamp(0, 1) * 255).round().to(torch.uint8).flatten().tolist()
        flat.extend(b)

    expected = layers * heads * seq * seq
    assert len(flat) == expected, f"packed {len(flat)} bytes, expected {expected}"

    # One number per layer per token: how large the residual stream vector is at
    # that point. hidden_states has an extra leading entry, the embedding output
    # before any block, so the slice starts at 1.
    stream_norm = [
        [round(float(h[0, t].norm()), 3) for t in range(seq)]
        for h in out.hidden_states[1:]
    ]

    logits = out.logits[0, -1]
    probs = logits.softmax(-1)
    top = probs.topk(12)
    top_tokens = [
        {
            "id": int(i),
            "text": tok.decode([int(i)]),
            "prob": round(float(p), 5),
        }
        for p, i in zip(top.values, top.indices)
    ]

    data = {
        "model": MODEL,
        "prompt": PROMPT,
        "seq": seq,
        "layers": layers,
        "heads": heads,
        "tokens": [tok.decode([int(i)]) for i in ids[0]],
        "tokenIds": [int(i) for i in ids[0]],
        "attnEncoding": "base64 u8, value/255, [layer][head][query][key] row major",
        "attn": base64.b64encode(bytes(flat)).decode("ascii"),
        "streamNorm": stream_norm,
        "topLogits": top_tokens,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))

    size = os.path.getsize(OUT)
    print(f"wrote {OUT} ({size / 1024:.0f} KB)")
    print(f"prompt: {PROMPT!r} -> {seq} tokens")
    print("top next tokens: " + ", ".join(f"{t['text']!r} {t['prob']:.3f}" for t in top_tokens[:5]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
