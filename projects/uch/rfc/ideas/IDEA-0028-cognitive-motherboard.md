# IDEA-0028 — Cognitive Motherboard

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "a motherboard has CPU, RAM, PCIe,
  USB, storage, GPU; UCH exposes its own hardware abstraction — Memory Bus,
  Reasoning Bus, Simulation Bus, Planning Bus, Knowledge Bus, Tool Bus,
  Identity Bus, Governance Bus, Learning Bus; everything plugs into buses,
  not APIs; third parties manufacture hardware for cognition"
- **Related:** IDEA-0010 (signal fabric), IDEA-0018 (cognitive silicon),
  IDEA-0019 (operating contracts), src/cognitive-plane/neural-event-bus,
  MANIFESTO §6

## Motivation

APIs are point-to-point; buses are plug-and-play. The claim: the kernel
should expose cognitive buses — named interconnects with defined bandwidth
and protocol — so that any capability (a new memory, a new reasoner, a new
tool surface) is a card that plugs into a bus, and third parties manufacture
hardware, not plugins. This is the motherboard that hosts the silicon cores
(IDEA-0018) and the fabric (IDEA-0010).

## The corpus cannot cover it because

The neural-event-bus is one internal signal channel; CIC is a transport
contract; organ contracts are interfaces. There is no bus topology — named
interconnects per cognitive function with attach/negotiation/certification —
and nothing a third party can "manufacture against" except the driver
surface.

## Proposal sketch

- Bus = named interconnect + protocol + bandwidth budget + admission rule
  (what kind of unit/card may attach, via IDEA-0019 contracts).
- Cards = silicon blocks (IDEA-0018) that announce instructions, latency,
  energy, benchmarks at attach.
- Board topology: identity/governance buses are kernel-owned; functional
  buses (reasoning, simulation, knowledge) are hot-swappable.

## Risk assessment

- Topology theater: a bus with no measured bandwidth or admission rule is a
  rename of the event bus. Each bus must have a budget and a contract.

## Where it lands

- Design doc `design/COGNITIVE-MOTHERBOARD.md`; relates to CIR compilation
  targets (units route over buses).

## Code impact

- None until the contract (0019) and silicon catalog (0018) exist; the
  motherboard is the composition rule over both.

## Next stage

Define one exemplar bus (knowledge) with protocol, budget, and admission
rule; prototype a third-party-style card against it.
