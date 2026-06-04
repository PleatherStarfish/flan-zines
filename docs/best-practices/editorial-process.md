# Editorial process & pedagogy — design best practices

**Audience: AI designing templates, the editor's planning surface, teacher review, and student
guidance.** Governs starter templates and onboarding (Step 3) and the review/publish gate (Step 6).
Primary source: **[PIVOT]** (Continue, Pivot, or Put It Down). Secondary: **[RESPONSIVE]** (pacing),
**[PIVOT-SCATTER]** (is it interesting?).

This document is different from the others: it turns an _editorial workflow_ into **product features
and student-facing prompts**. Our users are high-school writers, so The Pudding's process is also our
curriculum.

---

## TL;DR (the rules)

1. **SHOULD start every zine from a question**, and make the tool ask for it first. **[PIVOT]**
2. **SHOULD encode the "Put It Down" gates** (data exists? ethical? interesting? your story to tell?) as
   lightweight prompts, not blockers. **[PIVOT]**
3. **MUST make "pivot" and "put it down" first-class, blame-free actions** — drafts, version history,
   and parking a project are normal, not failure. **[PIVOT]**
4. **SHOULD require a storyboard/outline before building**, using the editor's outline/layers panel as
   the planning surface. **[PIVOT]**
5. **SHOULD enforce ethics + "right person to tell it" prompts** especially given minors and public
   content. **[PIVOT]**
6. **SHOULD keep stories short and well-paced** — a template default, not an afterthought.
   **[RESPONSIVE]**

---

## 1. The model: a pipeline with many honorable exits

**[PIVOT]** frames story-making as a sequence of crossroads, each with three valid outcomes:
**continue**, **pivot**, or **put it down** (temporarily or permanently). Critically: "there are a lot
more paths that lead to put it down than … to publish," yet that does not mean most work is scrapped —
it means **changing direction and parking ideas are acceptable at every juncture.**

**Maps to flan-zines:** the tool MUST make non-linear, exploratory work feel safe and normal. This is
why drafts, autosave, and version history (Step 1/3) are pedagogy, not just engineering — they are what
let a student pivot without fear. Surface them as encouragement ("parked," "earlier version"), never as
failure states.

---

## 2. The crossroads → product features (the mapping table)

Translate each **[PIVOT]** gate into a concrete feature/prompt. These are SHOULD-implement design
recommendations for templates and the editor.

| **[PIVOT]** crossroad                      | Student-facing prompt (in template/editor)                                  | Feature that supports it                           |
| ------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------- |
| Do you have a **unique question**?         | "What question does this zine answer? Has it been told? What's your angle?" | Question field as the first step of a template     |
| Can it be **answered with data**?          | "Reframe until it's answerable — e.g. 'how much smaller?' not 'why small?'" | A prompt + example; optional for non-data zines    |
| Do the **data exist** / can you make them? | "Is there a source? Can you collect it yourself (measure, count, scrape)?"  | Links to sources; a data/asset upload slot         |
| Is it **ethical** to use these data?       | "Could publishing this harm someone? Is it yours to share?"                 | Ethics checklist; ties to moderation gate (Step 6) |
| Are the **results interesting**?           | "Was the answer surprising? Tell a peer — do they care?"                    | Peer/teacher review prompt before publish          |
| Are you the **right person**?              | "Is this your lived experience/expertise? Should you collaborate?"          | "Invite a collaborator/reviewer" prompt            |
| **Create a plan** — still interesting?     | "Storyboard it. Share the outline. Does the flow land?"                     | Outline/layers panel = the storyboard surface      |
| **Make it** — still interesting?           | "Is the question answered clearly? Does it draw the reader in?"             | Preview + teacher review before publish            |

**Rule:** these prompts SHOULD guide, not gate. **[PIVOT]** treats them as judgment crossroads, not
validation errors. The only hard gate is **safety** (teacher approval + moderation, Step 6) — see §5.

---

## 3. Start from a question; reframe to be answerable

**Rule:** The primary "data story" template SHOULD open with a question prompt, and SHOULD coach
reframing toward answerable questions. — **Why:** **[PIVOT]** — The Pudding scopes stories with a
question "so [they] don't get buried under the size of it." Their example: "why are women's pockets so
small?" (hard to answer) → "how much smaller are women's pockets than men's?" (answerable). — **Pattern:**
template step 1 = a required-ish "Your question" text block (skippable for non-data/expressive zines,
which **[PIVOT]** allows — e.g. the Internet Boy Band Database forwent a question deliberately). —
**Maps to flan-zines:** ship a small set of **starter templates** that encode different shapes:
"Data story" (question-first), "Photo essay," "Interview," "Explainer." Templates lower the
blank-page barrier ([ARCHITECTURE.md §6](../../ARCHITECTURE.md)) _and_ teach the process.

---

## 4. Storyboard before building; use the outline as the planning surface

**Rule:** SHOULD encourage planning the flow before composing final blocks. — **Why:** **[PIVOT]** — The
Pudding "use[s] storyboards to roughly sketch out how we want our story to go," then shares them to test
whether "the flow of information and our planned presentation … [is] engaging." Their Mars-weather story
was saved by a **frame pivot** (welcome packet → postcards from the rover) with the same data. — **Maps
to flan-zines:** the editor's **outline/layers panel** is the storyboard. Recommend a flow where
students arrange sections/steps as an outline first, preview, get feedback, then flesh out. The
Edit/Preview toggle ([ARCHITECTURE.md §6](../../ARCHITECTURE.md)) is how they pressure-test the flow. —
**Gotcha:** don't force a heavyweight separate "storyboard mode" early — the lightweight outline reorder

- Preview is enough and keeps one source of truth (the document).

---

## 5. Ethics and "is it your story?" — load-bearing for minors

**Rule:** The ethics and right-person-to-tell-it prompts MUST be present, and the **safety gate MUST be
enforced server-side** (teacher approval + moderation), not left to a prompt. — **Why:** **[PIVOT]**
treats both as genuine stop conditions (their "Florida Man" and dress-code examples were put down on
ethics/standing grounds), and our context — minors publishing publicly — raises the stakes
(FERPA/COPPA, C1/C3). Soft prompts shape judgment; the hard gate prevents harm. — **Maps to flan-zines:**
the prompts live in the template/editor (advisory); the enforcement lives in the publish pipeline
(Step 6): visibility tiers + teacher approval + image/text moderation, all enforced at the
server/DB. The two layers are complementary — never replace the gate with a prompt, or the prompt with a
gate.

---

## 6. Pacing and the "still interesting?" checkpoints

**Rule:** Templates SHOULD default to short, well-paced stories (a handful of steps), and the editor
SHOULD offer a "still interesting?" preview checkpoint before publish. — **Why:** **[RESPONSIVE]** —
"short and sweet … a few steps to grab the user and make your point and then you're out"; over-long
stories fatigue. **[PIVOT]** and **[PIVOT-SCATTER]** both make "is it (still) interesting?" an explicit
gate, tested by talking to someone. — **Maps to flan-zines:** template defaults of 3–5 steps (echoing
[scrollytelling.md](scrollytelling.md) §7), and the teacher-review step doubles as the
human "is it interesting / clear?" checkpoint **[PIVOT]** recommends.

---

## 7. Make parking and pivoting feel safe (anti-failure UX)

**Rule:** The UI MUST frame drafts, parked projects, and old versions as normal, recoverable states —
never as failure. — **Why:** **[PIVOT]**'s thesis: "changing something or putting it down … seemed like
a form of failure. Of course, it wasn't." Making conscious continue/pivot/park decisions "make my
published stories so much better." For a classroom, psychological safety to abandon a draft is part of
learning to write. — **Maps to flan-zines:** "My Zines" SHOULD show drafts and parked work without
stigma; version history is presented as "your earlier takes," recoverable at any time; deleting is
deliberate and reversible where possible. (Student work loss is unacceptable — [ARCHITECTURE.md §6](../../ARCHITECTURE.md).)

---

## Implementation checklist (templates & editor planning)

- [ ] A "Data story" template opens with a **question** prompt; other templates (photo essay, interview,
      explainer) exist to lower the blank-page barrier.
- [ ] **[PIVOT]** gate prompts (data exists? ethical? interesting? right person?) appear as advisory
      guidance, not validation blockers.
- [ ] Outline/layers panel is usable as a **storyboard**; Edit/Preview toggle pressure-tests the flow.
- [ ] Ethics + collaborator prompts present; **safety enforced server-side** (approval + moderation),
      not via prompt.
- [ ] Template defaults are short/well-paced (3–5 steps); a pre-publish "still interesting?" review step
      exists.
- [ ] Drafts, parked projects, and version history are framed as safe, recoverable, non-failure states.

---

## Sources

- **[PIVOT]** Continue, Pivot, or Put It Down — Amber Thomas
- **[RESPONSIVE]** Responsive scrollytelling best practices — Russell Samora
- **[PIVOT-SCATTER]** The Making of the Weighted Pivot Scatter Plot — Russell Samora
