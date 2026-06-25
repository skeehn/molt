# Cilow Data Flow Analysis

## Complete Data Flow Diagram

### Write Path (Ingestion → Storage)

```
┌─────────────────────────────────────────────────────────────────┐
│                     CILOW WRITE PATH                             │
└─────────────────────────────────────────────────────────────────┘

📥 INPUT (multimodal)
  │
  ├─► remember(text/facts)
  ├─► ingest_image(image)
  ├─► ingest_pdf(pdf)
  ├─► ingest_audio(audio)
  │
  ▼
● cilow-api (Engine Handle)
  │
  ├─► remember() verb
  │   remember_text() verb
  │
  ▼
● cilow-extract (Write Path) — S0→S1→S4 pipeline
  │
  ├─► S0: Ingest/Normalize
  │   • Content-hash dedup
  │   • Provenance stamp
  │   • Idempotent
  │   [Data: Raw payload → Normalized payload]
  │
  ├─► S1: Route by Structure
  │   • StructuredExtractor: facts → ProposedClaims
  │   • NL extractor (S2 seam): prose → Facts → ProposedClaims
  │   [Data: Payload → ProposedClaim[]]
  │
  ▼
● cilow-entity (Canonicalizer)
  │
  ├─► normalize() — name → canonical form
  ├─► blake3_128(scope, canonical) → EntityId
  ├─► resolve() — never-auto-merge ER
  │   [Data: String → EntityId]
  │
  ▼
● cilow-truth (Truth Store) — S4: Conflict Resolution
  │
  ├─► remember(ProposedClaim[])
  ├─► resolve_write() — cardinality-gated supersession
  │   • Exclusive predicates → supersede old
  │   • Multiple cardinality → coexist
  ├─► store as 64-byte Claim (bitemporal)
  │   [Data: ProposedClaim → Claim with valid/transaction time]
  │
  ▼
┌──────────────────────┬────────────────────────┬──────────────────┐
│                      │                        │                  │
▼                      ▼                        ▼                  ▼
● cilow-store         ● cilow-embed           ● cilow-index     ● cilow-graph
  (Durable Log)         (Vector Encoder)        (Vector Index)    (Claim Graph)
  │                     │                       │                 │
  ├─► append()          ├─► composite()         ├─► insert()      ├─► add_edge()
  ├─► fsync()           │   • ŝ semantic        │   • MIPS scan   │   • 6 EdgeKinds
  ├─► CRC32             │     (1024d)           │   • as-of gate  │   • Fwd/Rev CSR
  │   [Storage:          │   • τ̂ bitemporal      │   [Index:        │   [Graph:
  │    LSM with          │     (64d)             │    Composite     │    Edges +
  │    crash safety]     │   • κ̂ key-value       │    vector →      │    Intervals]
  │                     │     (256d)            │    Node ID]      │
  │                     │   • (ĝ graph 128d)    │                  │
  │                     │   [Vector:             │                  │
  │                     │    4-facet 1472d]     │                  │
  │                     │                       │                  │
  └─────────────────────┴───────────────────────┴──────────────────┘
                              │
                              ▼
                         ☁ Voyage API
                           (live encoder)
                           or MockProvider
```

### Read Path (Query → Answer)

```
┌─────────────────────────────────────────────────────────────────┐
│                     CILOW READ PATH                              │
└─────────────────────────────────────────────────────────────────┘

📤 QUERY
  │
  ├─► recall(query, T)
  ├─► answer(query, T)
  │
  ▼
● cilow-api (Engine Handle)
  │
  ├─► recall() verb
  │   answer() verb
  │
  ▼
● cilow-recall (Read Pipeline) — 9-stage lifecycle
  │
  ├─► Stage 1: Validate + Scope
  │   • Check empty query, k=0
  │   [Data: Raw query → ValidatedQuery]
  │
  ├─► Stage 2: Intent Classify
  │   • 5 classes: Factual/Exploratory/Temporal/Negation/MultiHop
  │   [Data: Query → Intent]
  │
  ├─► Stage 3: Canonicalize Anchors
  │   ├─► cilow-entity.canonicalizer (SAME as write!)
  │   [Data: Query strings → EntityId[]]
  │
  ├─► Stage 4: Claim-Key Fast Path
  │   ├─► Point lookup CF-C (Factual + attr)
  │   ├─► Skip embedding (direct key hit)
  │   [Data: EntityId → Claim[] from truth store]
  │
  ├─► Stage 5: ANN Pass (Unified Index)
  │   ├─► cilow-embed.encode_query() → composite vector
  │   ├─► cilow-index.search() → candidate Claim IDs
  │   │   • HARD as-of-T interval gate (ZCAI guarantee)
  │   │   • Single inner product = joint top-k
  │   [Data: Query → ClaimID[] (top-k candidates)]
  │
  ├─► Stage 6: Graph PPR Multi-Hop (HippoRAG)
  │   ├─► Seed from query entities + ANN hits
  │   ├─► cilow-graph.ppr() → forward-push PPR
  │   │   • Intent-gated edges (EdgeKindMask)
  │   │   • As-of-T interval filter
  │   │   • Diffusion reaches related claims
  │   ├─► UNION diffusion claims into candidates
  │   ├─► RRF-fuse rank signals
  │   [Data: ClaimID[] → Expanded ClaimID[] + PPR scores]
  │
  ├─► Stage 7: As-of-T / Truth Filter + ER Projection
  │   ├─► cilow-truth.as_of(T) → drop SUPERSEDED/RETRACTED
  │   ├─► cilow-entity.project() → union alias equivalence class
  │   [Data: ClaimID[] → Valid Claim[] at time T]
  │
  ├─► Stage 8: Conformal Abstain (THE MOAT)
  │   ├─► cilow-truth.nonconformity() → score claims
  │   ├─► Compare vs calibrated threshold q̂
  │   ├─► IF score < q̂ → ABSTAIN
  │   │   [Output: { abstained: true, reason: "..." }]
  │   ├─► ELSE → pass claims through
  │   [Data: Claim[] → Claim[] OR Abstain]
  │
  ├─► Stage 9: Working-Set Pack
  │   ├─► Submodular facility-location coverage
  │   ├─► Pack under token budget
  │   [Data: Claim[] → Packed Claim[] + AssemblyReceipt]
  │
  ├─► + Verbatim Lexical Lane (C2)
  │   ├─► Session-scoped token inverted index
  │   ├─► Retrieve raw-text snippets
  │   ├─► Annotate onto receipt (no conformal standing)
  │   [Data: Query → Verbatim snippets]
  │
  ▼
📦 OUTPUT
  │
  ├─► RecallResponse:
  │   • Answer { claims, receipt } OR
  │   • Abstain { reason, receipt }
  │
  └─► answer() synthesizes from claims:
      ├─► ☁ GPT-5-mini via OpenRouter
      └─► Synthesized answer + citations
```

### Data Transformations

```
WRITE PATH DATA FLOW:
1. Raw Input (text/image/pdf/audio)
   → ProposedClaim (entity, predicate, value, provenance)
   → Claim (64-byte: EntityId, PredicateId, ValueHash, Beta, ValidTime, TxTime)
   → Composite Vector (1472d: semantic + temporal + kv + graph)
   → Index Node + Graph Edge + Durable Log Entry

READ PATH DATA FLOW:
2. Query String
   → Intent + EntityId[]
   → Composite Vector (1472d)
   → ClaimID[] (ANN candidates)
   → Expanded ClaimID[] (PPR multi-hop)
   → Valid Claim[] (truth-filtered)
   → Packed Claim[] OR Abstain (conformal gate)
   → Synthesized Answer with Citations
```

### Key Data Structures

```
64-byte Claim:
┌───────────────────────────────────────────────────┐
│ EntityId (16B) | PredicateId (16B) | Value (16B) │
│ Beta (8B) | ValidTime (8B×2) | TxTime (8B×2)     │
└───────────────────────────────────────────────────┘

1472-d Composite Vector:
┌────────────────────────────────────────────┐
│ ŝ semantic (1024d) — Voyage-4 embedding   │
│ τ̂ bitemporal (64d) — Fourier features      │
│ κ̂ key-value (256d) — Count-sketch          │
│ ĝ graph (128d) — HyperSAGE (future)        │
└────────────────────────────────────────────┘
  L2-normalized composite = one inner product
  ranks ALL facets jointly (Lemma 1 + 2)
```

## Mermaid Diagram

\`\`\`mermaid
graph TD
    %% Write Path
    Input[📥 Input: text/image/pdf/audio] --> API[cilow-api]
    API -->|remember| Extract[cilow-extract]
    
    Extract -->|S0: Ingest| Normalize[Normalize + Dedup]
    Normalize -->|S1: Extract| Claims[ProposedClaims]
    
    Claims --> Entity[cilow-entity: Canonicalizer]
    Entity -->|EntityId| Truth[cilow-truth: TruthStore]
    
    Truth -->|S4: Resolve| Store[cilow-store: Durable Log]
    Truth --> Embed[cilow-embed: Composite Vector]
    Truth --> Index[cilow-index: Vector Index]
    Truth --> Graph[cilow-graph: Claim Graph]
    
    Store -->|fsync| Disk[(💾 Disk: LSM)]
    Embed -->|1472d vector| Voyage[☁ Voyage API]
    Index -->|MIPS| IndexDB[(Vector Index)]
    Graph -->|PPR| GraphDB[(Graph CSR)]
    
    %% Read Path
    Query[📤 Query] --> API2[cilow-api]
    API2 -->|recall| Recall[cilow-recall: Pipeline]
    
    Recall -->|1: Validate| Intent[2: Classify Intent]
    Intent -->|3: Canonicalize| FastPath[4: Claim-Key Fast Path]
    FastPath -->|5: ANN| ANN[Unified Index Search]
    
    ANN -->|top-k| PPR[6: Graph PPR Multi-Hop]
    PPR -->|expanded| Filter[7: Truth Filter + ER]
    Filter -->|valid claims| Conformal[8: Conformal Abstain ⚡]
    
    Conformal -->|pass| Pack[9: Working-Set Pack]
    Conformal -->|fail| Abstain[❌ Abstain]
    
    Pack --> Answer[✅ Answer + Citations]
    Abstain --> Response[RecallResponse]
    Answer --> Response
    
    Response --> LLM[☁ GPT-5-mini: Synthesize]
    LLM --> Output[📦 Output]
    
    %% Styling
    classDef moat fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px
    classDef storage fill:#4dabf7,stroke:#1971c2
    classDef process fill:#51cf66,stroke:#2f9e44
    
    class Conformal moat
    class Store,Disk,IndexDB,GraphDB storage
    class Extract,Recall,Entity,Truth,Embed,Index,Graph process
\`\`\`

## Critical Insights

### 1. The Moat: Calibrated Abstention (Stage 8)
- **Conformal prediction** with measured coverage
- Returns claims ONLY if confidence ≥ calibrated threshold q̂
- Otherwise **abstains** — "I cannot answer from memory"
- **Prevents hallucination by design**

### 2. Read==Write Guarantee (cilow-entity)
- **SAME canonicalizer** for both paths
- Eliminates asymmetry bugs
- EntityId = blake3_128(scope, canonical-form)

### 3. Composite Vector = One Inner Product
- **4 facets** in one 1472d vector
- Single ANN pass ranks ALL facets jointly
- Lemma 1: ‖x_raw‖ constant across facets
- Lemma 2: ⟨x_raw(q), x_raw(c)⟩ = D(q,c)

### 4. Hard vs Soft Temporal
- **Soft**: τ̂ bitemporal facet nudges ranking
- **HARD**: as-of-T interval gate (ZCAI guarantee)
- Soft ranks, hard decides truth

### 5. PPR Multi-Hop (HippoRAG)
- **Candidate generation**, not just reranking
- Breaks single-vector ceiling
- Diffusion reaches semantically-distant-but-graph-connected claims

### 6. Never-Auto-Merge ER
- Merges are **reversible bitemporal `same_as` overlays**
- Never rewrite stored EntityId
- Read path unions alias equivalence class

## Performance Characteristics

**Write Path:**
- S0 → S1: ~1-5ms (extract)
- S4: ~10-50ms (truth resolution)
- Embed: ~100-200ms (Voyage API)
- Index: ~5-10ms (insert)
- Total: ~150-300ms per claim

**Read Path:**
- Stages 1-3: <1ms (validate, classify, canonicalize)
- Stage 4: <1ms (fast path)
- Stage 5: ~50-100ms (ANN + gate)
- Stage 6: ~50-150ms (PPR)
- Stage 7-9: ~10-50ms (filter, abstain, pack)
- Synth answer: ~500-1000ms (LLM)
- **Total: ~860-1200ms P95 (target <200ms)**

## Bottlenecks

1. **Set recall ~36%** (ANN + PPR not aggressive enough)
2. **P95 latency 860-1200ms** (PPR + LLM synthesis)
3. **Read path exclusive write lock** (zero parallelism)
4. **ANN index rebuilds from scratch** on boot
5. **Log GC uncalled** → disk leak

## Competitive Differentiators

1. ✅ **Calibrated abstention** (the moat)
2. ✅ **Multimodal** (text/image/audio/PDF → one graph)
3. ✅ **Bitemporal** (valid time × transaction time)
4. ✅ **Never-auto-merge ER** (reversible)
5. ✅ **Crash-safe** (fsync'd durable log)
6. ✅ **Unified substrate** (no borrowed DB)
7. ✅ **Token-efficient** (1.66× better than RAG at 96% accuracy)

---

**molt now understands Cilow's complete data flow!** 🎉
