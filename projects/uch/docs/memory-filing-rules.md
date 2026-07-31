# UCH Memory Filing Rules — MANDATORY for anything that writes to memory

Adapted to UCH's
kernel model (concepts / episodes / edges).

## The Rule

The PRIMARY SUBJECT of the content determines where it goes. Not the format,
not the source, not the skill that's running.

UCH memory has three write surfaces:

| Surface | Use for | Lifetime |
|---------|---------|----------|
| **Concept** (`entity` / `relation` / `process` / `quality` / `value`) | Durable knowledge: people, companies, ideas, mental models, policies | Evergreen — survives sleep cycles |
| **Episode** (`text` / `observation` / `structured` / `tool_call`) | Events, experiences, sessions, one-off observations | Temporal — recency-decayed, may consolidate |
| **Edge** (`is_a` / `part_of` / `causes` / `precedes` / `requires` / `contradicts`) | Relationships BETWEEN concepts | Evergreen, with provenance |

## Decision Protocol

1. Identify the primary subject (a person? company? concept? event?)
2. File it:
   - Durable subject knowledge → **concept** (`name` = the subject)
   - A specific event or observation → **episode** (attach `concepts[]`)
   - A relationship between two known subjects → **edge**
3. Cross-link: reference the concept's id in every episode that mentions it
   (episode `concepts[]`), and vice versa via edges.
4. When in doubt: what would you search for to find this again?

## Common Misfiling Patterns — DO NOT DO THESE

| Wrong | Right | Why |
|-------|-------|-----|
| Analysis of a topic as a one-off episode | -> concept (`process`/`value`) | It's durable knowledge, not an event |
| Article about a person as an episode only | -> concept + episode with `concepts[]` | Entity propagation is mandatory |
| Meeting-derived company info in one episode | -> ALSO create/update the company concept | Cross-referencing is mandatory |
| A reusable framework/thesis as raw text episode | -> concept (`value`/`relation`) | It's a mental model |
| A tool failure as a text episode | -> episode (`tool_call`) | Typed episodes decay correctly |

## Notability Gate

Not everything deserves a concept. Before creating a new concept:

- **Entities:** Will you interact with this again? Is it load-bearing for
  future queries?
- **Relations:** Does this edge explain how two known concepts interact?
- **Processes/values:** Is this a reusable mental model worth recalling later?
- **When in doubt, DON'T create.** A missing concept can be created later.
  A junk concept wastes attention and degrades search quality.

## Iron Law: Cross-Linking (MANDATORY)

Every episode that mentions a known concept MUST include that concept's id in
its `concepts[]` array, and the concept's access graph must gain the reverse
edge. An unlinked mention is a broken brain. The graph is the intelligence.

## Citation Requirements (MANDATORY)

Every fact written to memory must carry provenance. UCH's `Provenance` record
(`reliability`, `source`, `accessed_at`) is the mechanism.

Three shapes:

- **Direct attribution:** reliability 1.0, source = the user/session that stated it
- **API/external:** reliability 0.7-0.9, source = the provider or publication
- **Synthesis:** reliability 0.5-0.7, source = `compiled from {list of source ids}`

Source precedence (highest to lowest):

1. User's direct statements (highest authority)
2. Compiled truth (pre-existing brain synthesis)
3. Timeline entries (raw evidence)
4. External sources (API enrichment, web search — lowest)

When sources conflict, record BOTH as separate concepts/edges with a
`contradicts` edge between them. Don't silently pick one.

## Raw Source Preservation

Every ingested item should retain its raw source for provenance:

- Keep the source id in `Provenance.source`.
- For extracted facts, note which episode (source) each fact came from.
- Never overwrite an episode; create a new one and link with
  `preceding_episode`.

## Takes Attribution

When recording a gradeable claim (a take), the holder is WHO BELIEVES the
claim, not who it's ABOUT. Six rules:

1. **Holder ≠ subject.** Did this person SAY or CLEARLY IMPLY this?
   - YES → holder = the speaker's concept id
   - NO, it's your analysis OF them → holder = `brain` (the harness)
2. **Atomic claims.** One claim per take. Split compound rows.
3. **Amplification ≠ endorsement.** A retweet-style share caps conviction at
   0.55. Sharing something isn't endorsing every clause.
4. **Self-reported ≠ verified.** Self-report is a strong individual signal,
   not consensus fact — record it as the person's claim, not reality.
5. **No false precision.** Use 0.05 increments for conviction only
   (0.35, 0.55, 0.75). `0.74` and `0.82` imply calibration accuracy that
   doesn't exist.
6. **"So what" test.** Skip trivia (handles, follower counts, obvious bio
   fields). A take has to be load-bearing for some future query.
