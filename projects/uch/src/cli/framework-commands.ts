/**
 * Framework commands: `frameworks` (list / show / select / invariance /
 * stats) and `solve` (the full framework-composer pipeline).
 */

import {
  createFrameworkRegistry,
  FRAMEWORK_CATALOG_VERSION,
} from '../cognitive-plane/frameworks/registry.js';
import { checkRepresentationInvariance } from '../cognitive-plane/frameworks/knowledge/dikw.js';
import { FrameworkDecisionJournal } from '../cognitive-plane/frameworks/journal/decision-journal.js';
import { FrameworkComposer } from '../cognitive-plane/frameworks/composer/composer.js';
import {
  boolFlagAt,
  listFlagAt,
  numFlagAt,
  numListFlagAt,
  scoresFlagAt,
  type CliContext,
} from './context.js';

export async function handleFrameworks(ctx: CliContext): Promise<void> {
  const { args } = ctx;
  const registry = createFrameworkRegistry();
  const sub = args[1] ?? 'list';
  if (sub === 'show') {
    const id = args[2];
    const def = id ? registry.get(id) : null;
    if (!def) {
      console.error(`Unknown framework: ${id} — use 'uch frameworks' to list`);
      process.exit(1);
    }
    console.log(
      JSON.stringify(
        {
          id: def.id,
          family: def.family,
          name: def.name,
          purpose: def.purpose,
          bestFor: def.bestFor,
          whenNotToUse: def.whenNotToUse,
          stages: def.stages,
          selection: def.selection,
          source: def.source,
        },
        null,
        2,
      ),
    );
  } else if (sub === 'select') {
    const problem = args
      .slice(2)
      .filter((a) => !a.startsWith('--'))
      .join(' ');
    const familyIdx = args.indexOf('--family');
    if (!problem) {
      console.error(
        'Usage: uch frameworks select "<problem>" [--data 0.8] [--time 0.2] [--stakeholders 0.5] [--risk 0.7] [--complexity 0.5] [--family decisions] [--root-cause] [--human-centered] [--continuous-improvement] [--speed]',
      );
      process.exit(1);
    }
    const result = registry.select({
      problem,
      family: familyIdx >= 0 ? (args[familyIdx + 1] as never) : undefined,
      dataAvailability: numFlagAt(args, '--data'),
      timePressure: numFlagAt(args, '--time'),
      stakeholderInvolvement: numFlagAt(args, '--stakeholders'),
      risk: numFlagAt(args, '--risk'),
      complexity: numFlagAt(args, '--complexity'),
      rootCauseNeeded: boolFlagAt(args, '--root-cause'),
      humanCentered: boolFlagAt(args, '--human-centered'),
      continuousImprovement: boolFlagAt(args, '--continuous-improvement'),
      speedAdaptability: boolFlagAt(args, '--speed'),
    });
    console.log(
      JSON.stringify(
        {
          selected: {
            id: result.selected.id,
            name: result.selected.name,
            family: result.selected.family,
          },
          runnerUp: result.runnerUp ? { id: result.runnerUp.id, name: result.runnerUp.name } : null,
          rationale: result.rationale,
          alternatives: result.alternatives,
        },
        null,
        2,
      ),
    );
  } else if (sub === 'invariance') {
    const claim = args[2];
    const representations = args.slice(3);
    if (!claim || representations.length < 2) {
      console.error(
        'Usage: uch frameworks invariance "<claim>" "<representation 1>" "<representation 2>" [...]',
      );
      process.exit(1);
    }
    const result = checkRepresentationInvariance(
      claim,
      representations.map((content, i) => ({ label: `representation ${i + 1}`, content })),
    );
    console.log(
      JSON.stringify(
        {
          claim: result.claim,
          representations: result.representations,
          agreementPct: result.agreementPct,
          consistent: result.consistent,
          insight: result.insight,
        },
        null,
        2,
      ),
    );
  } else if (sub === 'stats') {
    const journal = new FrameworkDecisionJournal();
    await journal.load('.uccp/persist/framework-journal.json');
    console.log(JSON.stringify(journal.getStats(), null, 2));
  } else {
    const family =
      args.indexOf('--family') >= 0 ? (args[args.indexOf('--family') + 1] as never) : undefined;
    const frameworks = registry.list(family);
    console.log(`Cognitive Frameworks Library (catalog v${FRAMEWORK_CATALOG_VERSION})`);
    for (const f of registry.families()) {
      console.log(`\n${f.label} (${f.count})`);
      for (const def of frameworks.filter((x) => x.family === f.family)) {
        console.log(`  ${def.id.padEnd(18)} ${def.name}`);
      }
    }
    console.log(
      `\n${frameworks.length} frameworks — use 'uch frameworks show <id>', 'uch frameworks select "<problem>"', 'uch frameworks invariance "<claim>" "<repr1>" "<repr2>"', or 'uch frameworks stats'`,
    );
  }
  process.exit(0);
}

export async function handleSolve(ctx: CliContext): Promise<void> {
  const { args } = ctx;
  const argsPos = args.findIndex((a, i) => i >= 1 && !a.startsWith('--'));
  if (argsPos < 0) {
    console.error(
      'Usage: uch solve "<problem>" [--data 0.8] [--time 0.2] [--stakeholders 0.5] [--risk 0.7] [--complexity 0.5] [--family decisions] [--root-cause] [--human-centered] [--continuous-improvement] [--speed] [--options a,b,c] [--criteria cost,risk] [--weights 0.3,0.7] [--scores "8,4;9,5"] [--pros "x;y"] [--cons "x;y"] [--risk-causes "x;y"] [--risk-likelihood 0.7,0.5] [--risk-impact 0.8,0.6] [--evidence "x;y"]',
    );
    process.exit(1);
  }
  const problem = args[argsPos]!;
  const familyIdx = args.indexOf('--family');
  const composer = new FrameworkComposer();
  const result = composer.solve(problem, {
    family: familyIdx >= 0 ? (args[familyIdx + 1] as never) : undefined,
    dataAvailability: numFlagAt(args, '--data'),
    timePressure: numFlagAt(args, '--time'),
    stakeholderInvolvement: numFlagAt(args, '--stakeholders'),
    risk: numFlagAt(args, '--risk'),
    complexity: numFlagAt(args, '--complexity'),
    rootCauseNeeded: boolFlagAt(args, '--root-cause'),
    humanCentered: boolFlagAt(args, '--human-centered'),
    continuousImprovement: boolFlagAt(args, '--continuous-improvement'),
    speedAdaptability: boolFlagAt(args, '--speed'),
    options: listFlagAt(args, '--options', ','),
    criteria: listFlagAt(args, '--criteria', ','),
    weights: numListFlagAt(args, '--weights'),
    scores: scoresFlagAt(args),
    pros: listFlagAt(args, '--pros', ';'),
    cons: listFlagAt(args, '--cons', ';'),
    riskCauses: listFlagAt(args, '--risk-causes', ';'),
    riskLikelihood: numListFlagAt(args, '--risk-likelihood'),
    riskImpact: numListFlagAt(args, '--risk-impact'),
    evidenceFacts: listFlagAt(args, '--evidence', ';'),
  });
  const journal = new FrameworkDecisionJournal();
  await journal.load('.uccp/persist/framework-journal.json');
  for (const stage of result.stages) {
    journal.record({
      engine: stage.engine,
      family: stage.family,
      problem: result.problem,
      profile: result.profile,
      verdict: stage.verdict,
      mode: 'deterministic',
    });
  }
  await journal.persist('.uccp/persist/framework-journal.json');
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
