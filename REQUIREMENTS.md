# Zine — Core Requirements & Considerations (Codex evaluation rubric)

This is the **source of truth Codex grades against**. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
says _what to build and when_; this file says _what "correct" means_. Every PR is checked against the
relevant items here. Items are written to be **binary and evidence-based** — Codex must cite code, not
opinions.

---

## A. Product requirements & acceptance criteria

Traced to the original brief (R1–R4) and the school context (C1–C4). "Step" = where it lands.

| ID     | Requirement                                          | Acceptance criteria (testable)                                                                                                                                                                                                     | Step |
| ------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **R1** | Students have accounts and manage their own zines    | Sign in via SSO (Google; magic-link in dev). A user sees/edits **only their own** zines. Cross-user draft access is **denied by RLS** (test). Roles exist: student/teacher/admin.                                                  | 1    |
| **R2** | Zines publicly displayed on a homepage               | Homepage lists **only published** zines (title, author pen-name, cover). Each published zine has a **stable public URL**. Drafts/unpublished are **never** publicly reachable.                                                     | 5    |
| **R3** | Pudding-style structured content                     | A zine is sections → blocks from the **registry**. At minimum: heading, rich text w/ links, image (**alt required**), link/button, divider, spacer. Persisted as **validated JSON**; reorder works; author view ≡ published view.  | 2–3  |
| **R4** | "Fancy" scroll animations, configurable without code | These presets work and are inspector-configurable: **parallax, appear-on-scroll, sticky-steps, pin-horizontal (side-scroll), scroll-zoom dataviz, flocking**. Each is selected from a palette + a few knobs (no code).             | 4    |
| **C1** | Safety / moderation (minors, public content)         | Publishing can require **teacher approval**; with it on, a student cannot make a zine public unaided. Images screened (SafeSearch) + quarantined when flagged. **Report** mechanism exists. Visibility tiers enforced server-side. | 6    |
| **C2** | Accessibility (WCAG 2.1 AA)                          | No critical/serious **axe** violations on core flows. **`prefers-reduced-motion`** degrades every animation. Alt text enforced; semantic heading levels; keyboard-operable editor + reader; contrast checked.                      | all  |
| **C3** | Privacy / compliance                                 | SSO over self-collected passwords; **minimal PII**; **no third-party ad/tracking** scripts; data export/delete path exists.                                                                                                        | 1, 6 |
| **C4** | Performance on school Chromebooks                    | Published pages are **static/ISR + CDN**. Animation libs are **code-split** (absent from base bundle). Budgets met (§B).                                                                                                           | 4, 5 |

---

## B. Global invariants (checked on **every** relevant PR)

These must hold continuously. A regression here is **BLOCKING**.

### Security & authorization

- [ ] Authorization enforced at the **database (RLS)**, deny-by-default — never UI-only.
- [ ] **Service-role / admin keys never reach client code** (outside `src/lib/server`); enforced by lint + test.
- [ ] All external input validated with **Zod** before persistence.
- [ ] New tables ship with explicit RLS policies **and** a cross-user deny test.

### Child-safety (minors)

- [ ] Visibility tiers (`draft → in_review → published/unlisted`) enforced **server-side**.
- [ ] Teacher-approval gate (when enabled) **cannot be bypassed** from the client.
- [ ] Image uploads pass moderation; flagged assets are quarantined, not served.

### Accessibility (legal requirement for schools)

- [ ] `prefers-reduced-motion` honored globally; every animation declares a fallback.
- [ ] Required **alt text** enforced before publish; heading levels semantic.
- [ ] Keyboard-operable; visible focus; no critical/serious axe violations on touched UI.
- [ ] No information conveyed by motion alone; content works with animations off.

### Architecture & extensibility

- [ ] **Document/render separation:** `ZineRenderer` has no editor imports; editor produces validated JSON.
- [ ] **Registry is the only extension point:** adding a block/animation requires **no edits** to core
      renderer/editor internals (no hard-coded type switches).
- [ ] Editor preview and the public reader share the **same block `Render` components**.
- [ ] Document schema changes include a **migration + `schemaVersion` bump**; migrations are lossless.

### Performance

- [ ] Published pages render **static/ISR**; no per-request DB calls on the public read path.
- [ ] Heavy libs (**GSAP, Three.js/Threlte, D3**) are dynamically imported — **not** in the base chunk.
- [ ] Scroll animation uses **transform/opacity only**; effects mount near-viewport and unmount off-screen.
- [ ] **Budgets:** sample text zine base JS **< 100 KB gz**; LCP **< 2.5 s** on a mid-tier Chromebook
      profile; per-preset FPS caps present.

### Privacy & quality

- [ ] No third-party trackers/ad scripts; minimal PII; export/delete path exists.
- [ ] TypeScript **strict**; no `any` leaking through the schema/registry contracts.
- [ ] Tests at unit/component/integration/e2e; **CI green**; coverage **≥80%** on `src/lib/zine/**`.

---

## C. Non-goals (do **not** penalize their absence in the initial build)

So Codex doesn't mark down for out-of-scope gaps:

- Real-time multi-user collaboration on one zine (single-author editing is fine).
- Native mobile apps (responsive web only).
- Students writing **arbitrary code/HTML/JS** (presets + knobs only — this is a _safety_ boundary, not a limitation to "fix").
- AI generation features, comments/social feeds, monetization, multi-language i18n.
- Full district SSO (Clever/ClassLink) — Google SSO now; rostering is a later phase.

If a PR _adds_ one of these, that is scope creep → flag as **SUGGESTION to defer**, not an approval blocker on its own.

---

## D. How Codex scores a PR

For each PR, Codex outputs a checklist (PASS / FAIL / N-A + file:line evidence) over:

1. The Step's **"Done when"** criteria (IMPLEMENTATION_PLAN §Step N).
2. Every **Global Invariant** (§B) the diff touches.
3. The shared **Definition of Done** (IMPLEMENTATION_PLAN §5).
4. **No regression** to earlier steps.

**Blocking vs suggestion:**

- **BLOCKING** (forces NO-GO): any security/RLS gap, child-safety gap, data-loss path, critical/serious
  a11y violation, broken Definition of Done, or a registry-bypassing hard-coded type switch.
- **SUGGESTION** (non-blocking): polish, micro-perf, naming, optional refactors, deferred scope.

**Verdict:** `GO` only if there are zero BLOCKING findings **and** CI is green. Otherwise `NO-GO` with the
shortest list of required changes. Codex must **cite code**; "looks fine" is not a passing review.

---

## E. Traceability quick-map

```
R1 accounts/roles ........ Step 1   (RLS, SSO, roles)
R2 public homepage ....... Step 5   (gallery, ISR, visibility)
R3 structured content .... Step 2–3 (schema, registry, editor)
R4 fancy animations ...... Step 4   (animation registry, presets)
C1 safety/moderation ..... Step 6   (approval gate, SafeSearch, reports)
C2 accessibility ......... all steps (axe, reduced-motion, alt, keyboard)
C3 privacy/compliance .... Step 1, 6 (SSO, minimal PII, no trackers)
C4 performance ........... Step 4, 5 (code-split, static/ISR, budgets)
```
