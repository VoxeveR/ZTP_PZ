---
name: lab
description: Solve a ZTP laboratory (e.g. "solve lab 2", "/lab 2"). Splits the lab into its stages (2.1, 2.2, 2.3), implements each in NestJS with its own commit and acceptance criteria, asks for approval, then builds the lab report (.docx).
argument-hint: <lab number>
---

# Solving lab $ARGUMENTS

## Inputs (git-ignored, in `LABS/LAB<N>/`)
- Stage requirements: `LABS/LAB<N>/<N>.<k>/_docs/Lab<N>_<k>_instruction.md` (+ `images/`)
- Teacher's Python reference ("wirtualny dziekanat"): the code in `LABS/LAB<N>/<N>.<k>/`.
  Read it to see what's expected, then build the equivalent in NestJS for this project's domain.
  The `requirements.txt` there is only Python dependencies, not requirements.
- Scoring table: `LABS/LAB<N>/README.md` (if present). Make sure every scored item is covered.
- Report template (table of contents): `LABS/LAB<N>/imie_nazwisko_grupa_sprawozdanie_projekt_<N>.docx`

Read all stage instructions before starting, because later stages often change earlier design choices.
If something is missing (e.g. no template docx), tell the user and ask.

## Phase 1: one stage at a time (<N>.1, then <N>.2, then <N>.3)
For each stage:
1. Implement the stage following `CLAUDE.md` (vertical slicing, migrations, transactions, Swagger).
   Reuse the Docker files the teacher provides in `LABS/LAB<N>/<N>.<k>/` (Dockerfiles, docker-compose files):
   copy them into the repo and adapt them (service names, ports, networks, paths, our domain) rather than writing
   new ones. For any other teacher file that could be reused (SQL, seed data, env/config files, ...), ask the user
   first. In the stage summary, list what you reused and what you changed.
2. Add or extend e2e tests. In `backend/`, run `npm run typecheck`, `npm test`, and `npm run test:docker` if Docker is up.
3. Append a `## Etap <N>.<k>` section to `docs/LAB_<N>_ACCEPTANCE_CRITERIA.md` (create the file for <N>.1).
4. Show the user a short summary of the changes and the new criteria section, and **ask for acceptance**.
   If they don't accept, make the requested adjustments and ask again. Don't move on before acceptance.
5. Commit the stage: subject `<N>.<k>: <summary>`. If the stage is big, split it into logical commits
   `<N>.<k>-<part>: <summary>` (e.g. `2.1-entities: ...`, `2.1-endpoints: ...`). Don't push unless asked.

## Acceptance criteria format
Use `docs/LAB_1_ACCEPTANCE_CRITERIA.md` as the template. Copy its structure and tone, in Polish:
- `# Laboratorium <N>: mapa wymagań, plików i funkcji` + one intro paragraph (NestJS instead of FastAPI, which features).
- Per stage: `## Etap <N>.<k>` with the table `| Wymaganie | Gdzie pokazać | Konkretna funkcja / element |`.
  One row per requirement from the instruction, with relative links to files and the exact call chain
  (`Controller.x()` → `Service.x()` → `Repository.x()`). Optionally add a "Warto powiedzieć: …" line for the presentation.
- After the last stage: `## Uruchomienie aplikacji do prezentacji`, `## Testy naszej aplikacji — skrypty package.json`
  (table of commands → scope) and, if the teacher supplied tests, `## Oryginalne testy Python od prowadzącej`.

## Phase 2: report (only after all stages are accepted)
- Output: `docs/reports/sprawozdanie_projekt_<N>/Piotr_Zietek_SiRR_nst_sprawozdanie_projekt_<N>.docx`,
  with `assets/` and generator scripts in the same folder (mirror `docs/reports/sprawozdanie_projekt_1/`).
- Content: follow the table of contents from the lab's `imie_nazwisko_grupa_sprawozdanie_projekt_<N>.docx` exactly.
- Styling: match `docs/reports/sprawozdanie_projekt_1/Piotr_Zietek_SiRR_nst_sprawozdanie_projekt_1.docx`
  (fonts, colors, headers/footers, tables, code blocks, figure captions).
- Reuse the lab 1 tooling as a starting point and copy it, don't edit it in place:
  - `capture-evidence.cjs`: runs the app on a throwaway DB and takes Swagger UI screenshots, writes `evidence.json`
  - `build-report.cjs`: builds the .docx with the `docx` library (style helpers `p/h/code/table/image`)
  - `inspect-pdf.cjs`, `preview-docx.cjs`: render and check the layout
  - These load `docx`, `sharp` and `playwright` from `%TEMP%/ztp-report-tools/node_modules`.
    Install there with `npm i --prefix "$TEMP/ztp-report-tools" docx sharp playwright` if missing.
- Screenshots and outputs must come from real runs, never made up. Render the docx and check its layout before you hand it over.
- Ask for acceptance of the report, then commit it as `<N>: report`.
