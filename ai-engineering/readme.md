# AI Engineering — Notes

> Full detailed handbook (practical code, agents, architectures, system design, scaling) is in the
> [`handbook/`](handbook/) folder as an HTML doc site — open [`handbook/index.html`](handbook/index.html).
> This file is the original raw notes, cleaned up and organized.

## Machine Learning vs AI Engineering

**Machine Learning: Building the model**
- Creating the model
- Training the model
- Research and algorithms

**AI Engineering: Using the model**
- Making the model work in real products
- Fine-tuning the model
- Quantizing the model
- MCP, RAG, Vector DB
- System design: deployment

```
Android / iOS / Web ----- Backend
```

Before LLMs, this backend was mostly hand-written logic talking to services (e.g. Google APIs).

## What is an LLM?

**Large Language Model** — a model that understands, generates, and predicts text.
- Trained on a large dataset
- Large model size (# of parameters)

```
large dataset ---- model architecture (model.py) ---- output parameters.bin (400GB)
```
This combination (architecture + trained weights) is the **Foundation / Base model**. The model's output
depends entirely on the weights it learned during training.

### Running the LLM

```
He is good ------ [architecture model.py + parameters.bin] ------ is a good boy
```

Broken down into steps:

```
He is good
   ↓ tokenization
[12, 5, 7, 42]
   ↓ embeddings
[[1.0, 1.5, -0.5], ...]
   ↓ model.py architecture + parameters.bin
vectors (output)
   ↓ reverse of embeddings
   ↓ reverse of tokenization
is a good boy
```

### The "stale knowledge" problem

Suppose a model was trained in 2020. It works completely offline, without internet — but its knowledge
is frozen at training time.

```
current bitcoin price ---- [model.py + parameters.bin] ---- ~50k USD (stale / wrong)
```

Retraining a model from scratch costs hundreds of millions of dollars and isn't practical just to keep
facts current — especially for things that change in real time, like the bitcoin price. This is the
problem RAG and tool calling solve.

## RAG: Retrieval-Augmented Generation

Use an external source for updated information.

- **Retrieval** — fetching relevant information from an external source (docs, database, web)
- **Augmentation** — adding the retrieved information to the model's context
- **Generation** — producing the final answer using both the model's own knowledge and the retrieved data

```
Android / iOS / Web ---- Backend (adds crypto API) ----- LLM (model.py + parameters.bin)
```

**Example — AI Tutor:**
> Explain "Reflection" based on the top five blogs from a Google search.

```
Android / iOS / Web ---- Backend (crypto API + fetch top-5 blogs + Google search + if/else logic) ----- LLM
```

## MCP: Model Context Protocol

What HTTP is for the web, MCP is for AI context. MCP is an open standard for connecting AI applications
to external systems. Many MCP servers already exist on the internet, ready to plug in.

**Example — an MCP server that fetches crypto prices:**

```python
mcp_server: fetch_crypto_price   # [server code]
metadata = {
    "name": "fetch_crypto_price",
    "description": "fetch the current price of a cryptocurrency",
    "input_schema": {
        "symbol": { "type": "string" }
    }
}
```

Every MCP server exposes its tools along with metadata, so the LLM knows what's available and what
inputs each tool needs. **The description field matters a lot** — it's how the model decides which tool
to reach for.

```python
metadata = {
    "name": "fetch_youtube_videos_with_transcript",
    "description": "search youtube and fetch transcript of top videos",
    "input_schema": {
        "query": { "type": "string" },
        "max_result": { "type": "number" }
    }
}
```

**Limitation:** some tools return extreme amounts of data, which causes:
- Slowness
- Context window limit issues

**Fix:** don't dump raw tool output into context — convert it to vector embeddings, store in a vector DB,
and only pull the relevant chunks back into context when needed.

```
data ---> vector embeddings ---- vector DB ---- only relevant chunks pulled into context
```

## Fine-Tuning the LLM

Fine-tuning is further training of a foundation model on task-specific data, to make it perform better
for a particular use case.

- Fine-tuning customizes a foundation model for a specific task or domain
- Training from scratch requires huge data, compute, and time
- A foundation model already knows general language patterns
- Fine-tuning is faster, cheaper, and more practical than training from scratch

## Agents

A system that uses tools, makes decisions, and takes multiple actions to complete a complex task.

- **LangChain** — a framework for building LLM-powered applications

*(Full deep-dive on agents, ReAct loops, and multi-agent architectures is in [`07-agent-fundamentals.html`](07-agent-fundamentals.html) and [`08-agent-architectures.html`](08-agent-architectures.html).)*

## Quantization of the Model

```
updated-parameters.bin -----> quantized -----> quantized-parameters.bin
32-bit floating point   ---------------------> 16-bit floating point
```

| | Precision | Memory | Speed |
|---|---|---|---|
| Before quantization | High | More | Slower |
| After quantization | Lower | Less | Faster |

**Example naming convention (Ollama-style):**

| Model tag | Meaning |
|---|---|
| `llama2:7b` | Base model, 7B parameters |
| `llama2:7b-chat` | Fine-tuned for general chat conversation |
| `llama2:7b-chat-q2_k` | Quantized (smaller size, less precision, faster) |

## Memory Requirements

Training a model generally requires **4x–6x more memory** than running it for inference. This extra
comes from gradients, optimizer state, etc., used only during training.

**Example — Llama2 7B, 32-bit (4 bytes/param):**
| | Memory |
|---|---|
| Inference (prediction) | ~28 GB |
| Full training | ~112 GB – 168 GB (4x–6x inference) |

**Example — Llama2 7B, 8-bit (1 byte/param):**
| | Memory |
|---|---|
| Inference | ~7 GB |
| Training | ~42 GB (6x) |

### Full fine-tuning vs PEFT

Full fine-tuning takes roughly the same memory as training from scratch. To avoid that cost, use
**PEFT (Parameter-Efficient Fine-Tuning)**:

- **LoRA** (Low-Rank Adaptation)
- **QLoRA** (Quantized LoRA)

### LoRA (Low-Rank Adaptation)

- Freezes the base model
- Adds small trainable low-rank matrices on top

LoRA fine-tuning typically consumes only about **1.1x** the memory used during inference — dramatically
cheaper than full fine-tuning.

**Example — Llama2 7B, 32-bit:**
| Approach | Memory |
|---|---|
| Inference | 28 GB |
| Full fine-tuning | 112 GB |
| LoRA fine-tuning | ~31 GB (1.1x inference) |

### QLoRA (Quantized LoRA)

Quantize the model first (so you don't need to load all parameters at full precision), then apply LoRA
on top — this pushes memory requirements down even further, close to inference-level cost.
