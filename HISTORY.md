# Development History

## v0.3.0 — Spec v0.3 Compliance

### Decisions

1. **Remove legacy types** — `agent`, `human`, `hook` removed per spec v0.3 changelog. `command`/`cmd` aliases removed; only `run` is valid.

2. **Status value alignment** — Changed from `completed/failed` to `success/failure` to match Go runner and spec semantics.

3. **Package rename** — `@duckflux/runner` → `@duckflux/runtime` to reflect dual CLI + library nature.

4. **Schema upgrade to draft/2020-12** — Switched from `ajv` to `ajv/dist/2020` import for `$defs`, `oneOf`, and other draft/2020-12 features used in v0.3 schema.

5. **CEL expression cache** — Added parsed AST cache to avoid re-parsing the same expressions across evaluations.

6. **Boolean strictness** — Control flow expressions (`if.condition`, `when`, `loop.until`) must return `boolean`. Non-boolean results throw instead of coercing via `Boolean()`.

7. **Implicit I/O chain** — Output of step N flows as input to step N+1 through a chain value threaded through sequential execution. Merge rules: map+map merge (explicit wins), string+string (explicit wins), incompatible (explicit wins).

8. **Fallback preserves original** — On `onError: <participant>`, original step result is kept as `failure` (matching Go runner behavior) rather than being overwritten by the fallback result.

9. **Event hub architecture** — Hub interface with three backends (memory, NATS, Redis). Memory uses `EventEmitter`-style pub/sub with replay buffer. Hub is passed through `ExecuteOptions` and shared with sub-workflows.

10. **MemoryHub replay** — Published events are buffered so late subscribers still receive them, matching Go runner's `GoChannel` persistent mode.

11. **Wait implementation** — Three modes: sleep (only timeout), polling (until + poll interval), event (hub subscription with optional match condition). All respect `AbortSignal` for cancellation.

12. **Emit participant** — Resolves payload via CEL (string or object), supports fire-and-forget and acknowledged modes via hub.

13. **Inline participant detection** — Steps with `type` field are inline participants. Named (`as` present) store results in state; anonymous contribute only to chain.

14. **Duration `d` unit** — Added days support to `parseDuration()` for `1d` = 86400000ms.

15. **Input coercion** — CLI string values automatically coerced to integer/number/boolean based on declared type. Added constraint validation for enum, min/max, pattern, format, etc.

16. **Parallel output as array** — Parallel step output is an ordered array of branch outputs in declaration order, not a single merged value.

17. **Default output = final chain** — When no `output:` field is defined, the workflow returns the final chain value instead of `undefined`.

18. **CWD precedence chain** — `participant.cwd` > `defaults.cwd` > `options.cwd` (CLI --cwd) > `process.cwd()`.

19. **CLI output format** — Changed from printing full `WorkflowResult` JSON to printing only the resolved output value.

20. **Build setup** — Added `bun build` for ESM output + `tsc --emitDeclarationOnly` for type declarations. Dual `bun`/`import` export conditions in package.json.
