# Phase 1 – Canonical Data Contracts

This package defines the first version of the Insurance Rater Agent's shared data contracts using TypeScript and Zod.

## Why these contracts exist

The four supplied insurer rulebooks have different rating structures. The application therefore uses one canonical representation while preserving insurer-specific dimensions, rate scope, premium basis, validity dates, raw observations, override priority and evidence references.

## Included contracts

- `EvidenceReference`: citations to PDF pages, Excel sheets/cells, challenge-brief references, external references and owner clarifications.
- `Fact<T>`: a fact can be `KNOWN`, `MISSING`, `AMBIGUOUS` or `INVALID`. Known facts record provenance and evidence.
- `PolicyFacts`: normalized policy details, dates, vehicle information and premium breakup.
- `MappingRule`: RTO, cluster, vehicle segment and other insurer-specific mappings.
- `CommissionRule`: base rates, raw uninterpreted metrics, relative adjustments and incremental COA.
- `RuleBundle`: insurer's normalized grid sources, mappings, rules, date anchor and override precedence.
- `AnalysisResult`: OD/TP/Package outcomes, payout stages, confidence, unresolved issues and decision trace.

## Install

```bash
npm install
```

## Validate types

```bash
npm run typecheck
```

## Important modelling rules

1. Money and percentage values are decimal strings, not JavaScript floating-point numbers.
2. Every known fact must carry evidence and provenance.
3. Missing, ambiguous and invalid facts are not silently converted into values.
4. A Package rate is represented separately from OD and TP component rates. The component rates can be `NOT_SEPARATELY_SPECIFIED`.
5. A raw metric such as Go Digit's `Max CD2` can be preserved without treating it as a commission percentage.
6. A relative adjustment such as Reliance's "5% lesser" is represented as a multiplier (`0.95`), not as subtraction of five percentage points.
7. Tata AIG base commission, incremental COA, gross payout and settlement adjustments are separate stages.
8. Grid date selection does not silently fall back to the latest available grid.
9. `NOT_APPLICABLE` is different from a zero-percent rate.
10. The decision trace cites original policy/grid sources, not only normalized JSON.

## Scope boundary

These are Phase 1 contracts, not the rating engine. They define valid data shapes; they do not yet decide whether a rule matches a policy.
