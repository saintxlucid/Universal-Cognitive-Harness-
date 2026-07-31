# Phase I — Reverse Engineering Every Existing Memory Paradigm

This phase should span comprehensive research notes before a single line of architecture is written. We are reverse-engineering intelligence itself.

## Structure

Each research domain has its own subdirectory with findings, comparisons, and extracted principles.

## Domains

### A. Biological Memory `research/biology/`

The complete neuroscience of memory:

- **Cellular mechanisms**: Synaptic plasticity, LTP, LTD, spike-timing dependent plasticity, neurogenesis, myelination
- **Memory reconsolidation**: How memories are updated, not overwritten
- **Engrams**: Physical trace of memory, cellular ensembles
- **Sparse coding**: Efficient representation in neural populations
- **Predictive coding**: Hierarchical prediction-error minimization
- **Neuromodulation**: Dopamine (reward), Acetylcholine (attention), Serotonin (regulation), Norepinephrine (salience)
- **Brain structures**: Hippocampus (episodic), Prefrontal cortex (working memory), Amygdala (emotional), Basal ganglia (procedural), Cerebellum (motor), Entorhinal cortex (spatial)
- **Memory types**: Sensory, working, short-term, long-term, semantic, episodic, procedural, spatial, emotional, autobiographical, prospective, implicit, explicit
- **Systems consolidation**: How memories transfer from hippocampus to neocortex over time
- **Sleep and memory**: Hippocampal replay, sharp-wave ripples, slow-wave oscillations, REM consolidation

**Output**: `biology/` — reference with extracted computational principles

### B. AI Memory Systems `research/ai-memory/`

Deep analysis of every production and research memory system:

**Production systems:**
- Mem0 — fact extraction, consolidation, user profiles
- Letta/MemGPT — working/core/archival memory hierarchy, sleep-time compute
- Zep/Graphiti — temporal knowledge graphs, evolving relationships
- LangMem/LangGraph — checkpointing, namespaces, state restoration
- Cognee — cognitive architecture for agents
- Supermemory — personal AI memory
- A-MEM — agentic memory with user steering
- memU — user-centered memory

**Research systems:**
- MemMachine — ground truth preservation, episodic retrieval
- MemGate — trustworthy retrieval with gating
- HippoRAG — hippocampal-inspired retrieval
- MirrorRAG — reflective retrieval
- GraphRAG — graph-based RAG
- RMT — recurrent memory transformer
- Transformer-XL — segment-level recurrence
- Compressive Transformer — compressed memory
- RETRO — retrieval-enhanced transformer
- Differentiable Neural Computers
- Neural Turing Machines
- Memory Networks

**Output for each**: Strengths, weaknesses, architectural diagram, key insight, what we can borrow

### C. Database & Storage Systems `research/databases/`

How information is stored and retrieved at scale:

- LSM Trees (LevelDB, RocksDB)
- B-Trees (SQLite, Postgres)
- MVCC and transaction models
- CRDTs for conflict-free replication
- Graph databases (Neo4j, TigerGraph) — property graphs vs RDF
- Vector search (FAISS, HNSW, DiskANN, ScaNN)
- Vector databases (Milvus, Weaviate, Qdrant, Chroma, Pinecone)
- Memory-mapped files, caching strategies
- Sharding, snapshots, journaling, version control
- Compression algorithms

**Output**: `databases/` — principles for NeuralFS

### D. Operating Systems `research/os/`

Cognitive scheduling and resource management:

- Schedulers (CFS, O(1), lottery scheduling)
- Virtual memory, paging, page replacement (LRU, LFU, ARC)
- NUMA awareness, memory allocation
- Garbage collection (generational, concurrent)
- Interrupt handling, priority queues
- Kernel architecture (monolithic, microkernel)
- IPC mechanisms
- Task scheduling, thread pools, pipelines

**Output**: `os/` — scheduling and resource arbitration principles for the Cognitive Kernel

### E. Human Learning & Expertise `research/learning/`

How humans actually get good at things:

- Expertise acquisition (10,000 hours, deliberate practice)
- Curiosity-driven learning
- Insight generation ("aha" moments)
- Creativity and flow states
- Abstraction hierarchy formation
- Analogy and cross-domain transfer
- Chunking and automaticity
- Metacognition and self-regulated learning
- Cognitive biases and error correction
- How children learn vs how adults learn
- How artists, scientists, and programmers think

**Output**: `learning/` — learning algorithms and curricula for the cognitive organism

### F. Philosophy of Knowledge `research/philosophy/`

The foundational definitions we need:

- Epistemology — what is knowledge? justified true belief?
- Ontology — what exists? categories of being?
- Truth — correspondence, coherence, pragmatic, consensus?
- Belief — degrees of belief, updating, revision
- Identity — personal identity over time, self-model
- Consciousness — phenomenal experience, qualia, access consciousness
- Agency — goal-directed behavior, autonomy, intentionality
- Meaning — semantics, reference, significance

**Output**: `philosophy/` — the Cognitive Constitution

### G. Intelligence Research `research/intelligence/`

What the frontier labs are doing:

- DeepMind: Gato, Dreamer, AlphaGo/MuZero, episodic memory, continual learning
- OpenAI: CLIP, DALL-E, GPT series, RLHF, process reward models
- Anthropic: Constitutional AI, interpretability, features
- Microsoft: MatterGen, cognitive architectures
- Google: Pathways, PaLM, Gemini, Titans (neural long-term memory)
- NVIDIA: Cosmos, world models
- Meta: LLaMA, memory layers, continual learning
- Academic: Stanford (CRLM), MIT (cognitive architectures), Berkeley (LLM agents), CMU (neurosymbolic)

**Output**: `intelligence/` — frontier patterns to adopt
