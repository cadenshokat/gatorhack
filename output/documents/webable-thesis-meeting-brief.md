# WebAble thesis outline and study plan

WebAble thesis outline and study plan

Caden Shokat  |  Discussion with Dr Neha Rani  |  28 October 2026

I propose evaluating AI-assisted web interface adaptation through a controlled comparison of original and adapted webpages. The meeting should settle the participant criteria, the primary outcome, and the final study procedure so that the exemption submission, study app, and thesis describe the same research.

## Proposed title and research question

Evaluating AI-Assisted Web Interface Adaptation for Adults Aged 50 and Older

Among older adults who report recurring web-use difficulties, how does AI-assisted interface adaptation affect task performance and perceived usability compared with original webpages?

The proposed age criterion is 50 or older. The report should state that cutoff explicitly and describe the actual age distribution; age alone will not be treated as evidence of disability or cognitive impairment.

## Research purpose and contribution

WebAble changes the presentation, organization, and interaction demands of webpages. Recruiting people with recurring web-use difficulties connects the study to the barriers the system addresses. The experiment will evaluate the complete adaptation approach on selected mobile tasks.

- The system contribution is a documented pipeline combining AI page analysis and content organization with participant-specific display and interaction settings.

- The empirical contribution will be evidence about usability, task performance, individual variation, and adaptation failures in the recruited sample.

The original-versus-adapted comparison estimates the effect of the combined approach. It will not isolate the AI model's contribution or establish superiority over a fixed accessibility configuration.

## Decisions for today

- Confirm the 50-or-older criterion and define how recurring web-use difficulty will be screened before enrollment.

- Confirm two conditions and a short calibration phase separate from the scored evaluation tasks.

- Choose one primary outcome and the questionnaire version; decide whether understanding content needs a dedicated task.

- Confirm a feasible sample target, recruitment route, pilot plan, and the steps needed before collection under the revised determination.

- Confirm the department's thesis format, forms, defense expectations, deadlines, and whether a separate course report is required.


---

## Proposed thesis structure

Use one research narrative throughout: define the barrier, explain the adaptation approach, evaluate it fairly, and interpret the evidence. These sections can be chapters or shorter paper sections, depending on the department's format.

### 1 Introduction

- Explain the problem of differing web-use needs and motivate AI-assisted adaptation. State the question, population, study context, and contributions.

- Establish the uncertainty the study addresses. Describe expected benefits as hypotheses rather than existing findings.

### 2 Background and related work

- Cover overlapping accessibility needs, established interface adaptations, ability-based personalization, AI-assisted accessibility, and prior evaluation methods.

- Identify precedents and the specific gap. Use a comparison matrix of population, adaptation method, evaluation, and remaining limitation. [1-5]

### 3 Design rationale and adaptation approach

- Connect each supported barrier to assessment evidence, an available adaptation, and an outcome. Explain what AI decides and what fixed rules decide.

- Show the proposed mechanism with a pipeline diagram and one worked example. Do not describe the calibration as a clinical assessment.

### 4 System and experimental implementation

- Describe the tested WebAble version, frozen webpage copies, participant settings, AI outputs, constraints, checks, fallback behavior, and event logging.

- Distinguish the full extension from the hosted study. Include a before-and-after example and a table of included and omitted features.

### 5 Study methods

- Report eligibility, recruitment, sample-size rationale, conditions, tasks, counterbalancing, calibration, practice, procedure, measures, analysis, and ethics.

- Explain how the design controls learning and task difficulty. Include exact task wording and a rationale for each task. [1]

### 6 Results

- Describe the sample and adaptations delivered, then report the primary comparison, supporting outcomes, failures, individual results, and participant feedback.

- Present effect sizes and uncertainty. Keep planned analyses separate from exploratory observations and do not invent results while drafting.

### 7 Discussion and limitations

- Answer the research question and compare findings with prior work. Explain benefits, costs, unexpected outcomes, and practical design implications.

- Address the sample, saved pages, brief exposure, visible condition differences, AI replay, and the limits of the comparison. No significant difference does not establish equivalence.

### 8 Conclusion and future work

- State what the evidence supports about the tested approach and identify the next study justified by the findings.

- Keep conclusions proportional to the participants, tasks, and system version tested.


---

## Study design and evidence plan

### Recommended participant flow

Consent and screening; short calibration; practice; three evaluation tasks in the first condition; usability ratings; break; three matched tasks in the other condition; usability ratings and final feedback. This retains the current two-round structure while revising eligibility.

If original-page examples replace some onboarding, use separate calibration pages before both experimental conditions. Freeze the resulting settings before evaluation. Counterbalance condition order and matched task sets; using the scored original round to generate the adaptation would force it to come first.

### Measures and their interpretation

| Measure | Role | Evidence and interpretation |
|---|---|---|
| Perceived usability | Proposed primary | Same instrument after each condition. Specify its version and scoring before collection. |
| Task success and accuracy | Supporting | Correct end state or answer. Define success, failure, and skips for every task. |
| Task completion time | Supporting | Use a consistent start and stop. Report failures and accuracy alongside speed. |
| Feedback and interaction logs | Exploratory | Explain experienced benefits and problems. Taps and scrolls alone do not establish confusion or intended selection errors. |
| Adaptations delivered | Implementation check | Record what changed, what reverted, and failures. Preserve these cases in the primary comparison. |

If the thesis claims improved understanding, add an interpretation or application task. The current find-the-fact tasks establish information access more directly than comprehension.

### Analysis and sample size

Estimate the paired adapted-minus-original usability difference with a confidence interval. Report task accuracy and time jointly, account for repeated tasks and order, and keep subgroup patterns exploratory. Finalize exclusions and missing-data handling before main collection.

The existing protocol proposes 4-6 pilots followed by 32 main participants. Treat that as provisional for the revised population. Confirm recruitment feasibility and the power justification for the selected primary outcome. Pilots refine the procedure; exclude their data from the main analysis.

### Changes needed before collection

- Add the 50-or-older and functional-difficulty screening. Choose a frequency threshold and document recruitment and consent procedures.

- Choose the questionnaire version. The app currently uses a modified seven-point SUS; do not apply five-point SUS benchmarks directly to that score.

- Align the revised determination, participant information, protocol, and app. Pilot task equivalence and duration, then freeze pages, instruments, and software version.


---

## Source roadmap and writing priorities

Use the committee papers to support distinct parts of the argument. Their populations and systems do not establish WebAble's effectiveness.

**1 Soni and colleagues 2024.** [A Comparative Usability Study of Physical Multi-touch versus Virtual Desktop-Based Spherical Interfaces](https://init.cise.ufl.edu/wp-content/uploads/sites/378/2024/04/soni-IEEEVR2024.pdf). Main methods model: matched tasks, counterbalancing, usability, workload, and qualitative feedback. Its 21 participants and different technology are not a sample-size justification for this study.

**2 Gajos Wobbrock and Weld 2008.** [Improving the Performance of Motor-Impaired Users with Automatically-Generated Ability-Based Interfaces](https://homes.cs.washington.edu/~weld/papers/gajos-chi08-supple.pdf). Precedent for ability-based interface personalization. Establish what is already known before identifying the contribution of the current mobile-web evaluation.

**3 Larco and colleagues 2021.** [Thinking about Inclusion](https://www.mdpi.com/2071-1050/13/19/10989). Model for connecting needs, design requirements, development, and evaluation. Distinguish evidence from therapists and testers from evidence about intended users.

**4 Rezvani Pour 2025.** [AI interfaces and media accessibility for people with spinal cord injuries](https://soc.gpmsh.ac.ir/article_224658.html). Interview-based context for reliability, complexity, fatigue, and independence. Use reported experiences to motivate feedback questions, not causal effectiveness claims.

**5 Selvam 2025.** [Implementing AI-driven Web Accessibility](https://ieeexplore.ieee.org/document/11296155). Related-work positioning for AI accessibility checks and adaptive rendering. Review full methods before relying on numerical improvement claims.

**6 W3C Web Accessibility Initiative.** [Older Users and Web Accessibility](https://www.w3.org/WAI/older-users/). Background on overlapping accessibility needs. Use functional eligibility and describe age explicitly; do not infer impairment from age.

**7 UF thesis guidance.** [Libraries submission requirements](https://guides.uflib.ufl.edu/etds/honors_theses). Submit the final approved, accessible PDF. Departmental format, deadlines, and repository requirements must be confirmed. CISE directs students to its honors Canvas page.

**8 UF honors thesis examples.** [Overstreet 2020](https://www.cise.ufl.edu/research/cad/Publications/overstreetThesis.pdf). Overstreet separates contributions, related work, method, and evaluation. Cheon connects design requirements to the prototype and user evaluation. Neither is a universal length or formatting rule.

[Cheon thesis](https://ufdcimages.uflib.ufl.edu/AA/00/09/86/12/00001/Cheon_Serene_Haekyeong_Honors_Thesis.pdf)

[Engineering honors guidance](https://www.eng.ufl.edu/undergraduate/programs-and-partnerships/center-for-experiential-learning/join-a-research-lab/graduating-with-honors/)

[CISE honors instructions](https://cise.ufl.edu/academics/undergraduate/student-resources/seniors/)

### Writing and supporting materials

Thesis package: title page, abstract, acknowledgments and contents as required, main chapters, references, and appendices. Confirm the department's preferred format. [7-8]

Start with the research question, related-work matrix, design rationale, and methods. Prepare the pipeline figure, before-and-after example, task table, and measures table. Draft results headings now and fill them after analysis; write the abstract last.

Prepare participant materials, a study script, the analysis plan, prompts and configurations, and an individual contribution statement. Ask whether the course report and honors thesis can share a manuscript. Confirm the required committee forms, oral presentation, and submission dates with the department. [7]

Project evidence: WebAble study protocol mobile-replica-1.0.0 and source reviewed on 28 October 2026. Existing implementation: two conditions, reading and pointing calibration, frozen AI page outputs, and no paragraph rewriting or Finding assessment. The revised eligibility and any new calibration tasks remain proposed changes.
