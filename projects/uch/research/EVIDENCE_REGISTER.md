# Initial Evidence Register

This is the seed register for Phase I. It records what a source directly
supports; it is not a ranking of products or a claim that benchmark scores are
comparable across papers.

| Source | Direct contribution | COS implication | Limitation / open question |
| --- | --- | --- | --- |
| [MemGPT](https://arxiv.org/abs/2310.08560) | Virtual-context management moves information between limited active context and archival stores. | Research tiered working and archival context. | Does not define truth maintenance or cross-agent governance. |
| [Letta context hierarchy](https://docs.letta.com/guides/core-concepts/memory/context-hierarchy) | Different context sources have different scale and retrieval properties. | Separate always-visible operating profile from retrieved evidence. | Mutable core blocks require strict validation. |
| [Mem0](https://arxiv.org/abs/2504.19413) | Selective extraction, consolidation, and graph memory can lower context cost. | Evaluate claim extraction and compact retrieval packets. | Extracted facts may be lossy or wrong. |
| [Zep / Graphiti](https://arxiv.org/abs/2501.13956) | Temporal knowledge graphs can preserve changing relationships and provenance. | Make valid-time, recorded-time, and source lineage first-class. | Graph operations add latency, ontology, and entity-resolution costs. |
| [A-MEM](https://arxiv.org/abs/2502.12110) | Dynamic notes and links can evolve an agentic memory network. | Test controlled concept linking and revision. | Autonomous link growth can amplify error or clutter. |
| [MemMachine](https://arxiv.org/abs/2604.04853) | Keeping full episodes and retrieving surrounding context reduces destructive ingestion compression. | Preserve immutable source episodes beneath all derived memories. | Reported results need independent reproduction and security evaluation. |
| [MemGate](https://arxiv.org/abs/2606.06054) | Similarity retrieval can cause leakage, sycophancy, tool drift, and jailbreak-like effects; a query-conditioned gate can mitigate them. | Treat recall as a policy and security boundary. | Validate across COS-specific projects, users, and tool permissions. |
| [CoALA](https://arxiv.org/abs/2309.02427) | Cognitive architectures organize agents around modular memory and structured actions. | Keep modules behind stable contracts and use a clear action vocabulary. | It is a framework for analysis, not a turnkey implementation. |
| [Generative Agents](https://arxiv.org/abs/2304.03442) | Observation, reflection, planning, and dynamic retrieval jointly improve long-running behavior. | Evaluate episodes, reflection artifacts, and plans as separate objects. | Simulation believability is not evidence of truthfulness or safety. |
| [Reflexion](https://arxiv.org/abs/2303.11366) | Verbal feedback from outcomes can improve later trials without weight updates. | Record concise postmortems tied to verification outcomes. | Self-reflection must not self-certify as fact. |
| [LongMemEval](https://proceedings.iclr.cc/paper_files/paper/2025/file/d813d324dbf0598bbdc9c8e79740ed01-Paper-Conference.pdf) | Long-term memory includes extraction, multi-session reasoning, temporal reasoning, updates, and abstention. | Evaluation must include correction and abstention, not only retrieval accuracy. | It is conversational and cannot replace software-workspace tests. |
| [LongMemEval-V2](https://arxiv.org/abs/2605.12493) | Full trajectory evidence can beat simple RAG for experienced-agent questions at higher latency. | Keep a slow, auditable evidence path alongside compact recall. | Benchmark methods may not map directly to COS workloads. |
| [Systems consolidation](https://www.nature.com/articles/s41586-025-08993-1) | Remote episodic memory may reorganize toward gist/generalization while original precision changes. | Separate immutable episodes from revisable abstractions and summaries. | Biological findings do not prescribe software designs. |
| [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/index) | MCP standardizes JSON-RPC interaction with tools, resources, and prompts. | Expose COS capabilities through an MCP adapter. | It does not define cognitive state, truth, lifecycle, or cross-agent governance. |
| [A2A specification](https://a2a-protocol.org/latest/) | A2A standardizes agent discovery, modalities, collaboration, and tasks between independent agents. | Use an A2A adapter for delegated COS work. | It does not prescribe a shared cognitive ontology or persistence model. |
| [CloudEvents](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md) | CloudEvents provides portable event metadata and formats across systems. | Map asynchronous COS lifecycle events to CloudEvents. | It intentionally does not define the processing model or cognitive semantics. |

## Evidence policy

- Prefer primary papers, official specifications, and reproducible repositories.
- Record benchmark setup, model, dataset version, cost, and evaluator before
  comparing results.
- Treat vendor benchmark claims as hypotheses until reproduced.
- A source can inform a mechanism without justifying a product decision.
