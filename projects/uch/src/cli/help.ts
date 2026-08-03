/**
 * The `uch` CLI help text. Kept in its own module so both the dispatch shell
 * (index.ts) and command families that print full help on bad usage can
 * share it without a circular import.
 */

export function printHelp(): void {
  console.log(`UCH — Universal Cognitive Harness v0.2.0

USAGE:
  uch                          Start MCP STDIO server (for AI tool integration)
  uch serve                    Start HTTP/Sse server (legacy mode)
  uch status                   Show cognitive system status
  uch attach                   Attach to workspace (discover manifest, negotiate, start drivers)
  uch manifest init            Create a workspace manifest (.uch/uch.manifest.json)
  uch manifest show            Show the discovered workspace manifest
  uch ingest                   Ingest git history into memory
  uch session list             List saved sessions
  uch session export <id>      Export session as handoff document
  uch remember <text>          Store something in memory
  uch recall <query>           Search memory
  uch think "<prompt>"         Internal reasoning turn (cognitive tools only)
  uch chat "<prompt>"          Alias for think
  uch skills                   List loaded skills
  uch skill scan <dir>         Scan an external skill pack (SKILL.md format)
  uch skill catalog <dir>      Catalog an external skill repo
  uch skill import <dir> <n>   Install skill(s) from external repo into ./skills [--force]
  uch skill create <name>      Create a new skill from a template
  uch skill optimize           Analyze skill invocations and suggest improvements
  uch skill provenance         Show which skills were imported and from where
  uch mem-search "<query>"     Progressive memory search (layer 1: index)
  uch mem-timeline <id>        Chronological context around a memory (layer 2)
  uch mem-get <id> [id...]     Full details for specific memory IDs (layer 3)
  uch gap-analysis "<query>"     Synthesis with citations and gap analysis
  uch synthesize "<query>"       Grounded synthesis: claims with [source] citations
  uch takes add "<claim>" <cv>   Record a gradeable claim (conviction 0-1)
  uch takes resolve <id> <q>     Grade a take: correct|incorrect|partial|unresolvable
  uch takes list                 List takes (--open / --resolved)
  uch calibration                Show calibration profile (Brier, scorecards, bias tags)
  uch principles-check         Evaluate a change against the 4 coding principles
  uch organic-score            Score a change against the 15-metric Organic Score rubric (>=90 pass); [--kind code|design|plan|architecture] runs the engineering gates (vetoes hard-reject), [--findings <json>] adds explicit findings
  uch engineering-review       Run the deterministic engineering gates over a diff or prose (complexity, coupling, SPOF, failure surfaces, laws); [--kind], [--paths]
  uch engineering-benchmark    Run the labeled benchmark corpus and report contract status (veto recall, latency, negative controls)
  uch frameworks               List the Cognitive Frameworks Library (10 families)
  uch frameworks show <id>     Show a framework's stages and selection metadata
  uch frameworks select "<problem>" --data 0.8 --time 0.2 --stakeholders 0.5 --risk 0.7 [--family decisions]
  uch frameworks stats            Show framework usage analytics (decision journal)
  uch solve "<problem>"           Full pipeline: select → understand → diagnose → decide → risk gate → plan
  uch productivity             Show Productivity Kernel status (inbox, MIT, plan-execution rate)
  uch fusion                   Show Signal Fusion Engine status (runs, bands, risk-flag rate)
  uch governance "<change>"    Review a change against the Clean Code Covenant (allow/review/block)
  uch package install <dir>    Gate and install a cognitive package from a directory (manifest.json + payload)
  uch package update <dir>     Gate and update a cognitive package to a new version
  uch package revoke <name>    Revoke an installed package (stops new execution, drains sessions)
  uch package list             List installed cognitive packages
  uch package audit            Show the package audit ledger (install/update/revoke, in order)
  uch cir compile "<goal>"     Compile an Intent into a CIR stream (RFC-0004); [--context "..."] [--scope ws:x] [--by <driver>]
  uch cir optimize "<goal>"    Compile + run the 17-pass optimizer (reports, energy/token deltas)
  uch cir execute "<goal>"     Compile + optimize + execute (replay substitution, deterministic subset)
  uch cir benchmark            Run the RFC-0004 §14 deterministic benchmark corpus (six contracts)
  uch profile [file] [--verbose]  Cognitive Profiler: per-stage attribution + metrics over a trace ledger
  uch help                     Show this help

ENVIRONMENT:
  OPENAI_API_KEY               For LLM completions and embeddings
  ANTHROPIC_API_KEY            Alternative LLM provider
  OPENAI_BASE_URL              Custom API endpoint (optional)

EXAMPLES:
  OPENAI_API_KEY=<your-key> uch            Start MCP server with AI
  OPENAI_API_KEY=<your-key> uch ingest     Ingest git history
  uch session list                      List saved sessions
`);
}
