---
name: lab
description: Solve a ZTP laboratory (e.g. "solve lab 2", "/lab 2"). Splits the lab into its stages (2.1, 2.2, 2.3), implements each in NestJS with its own commit and acceptance criteria, asks for approval, verifies the whole lab with manual test cases run in Swagger UI via Playwright, then builds the lab report (.docx).
argument-hint: <lab number>
allowed-tools: mcp__playwright, mcp__plugin_playwright_playwright
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
2. Write new tests only if the stage instruction or scoring table asks for them (e.g. lab 1.3 had a "Testy"
   section and scored tests), and only the kind and scope it asks for. Otherwise don't add tests. Either way,
   existing tests must keep passing: in `backend/`, run `npm run lint`, `npm run typecheck`, `npm test`, and
   `npm run test:docker` if Docker is up. If a change breaks an existing test, fix the code or update that test.
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

## Phase 2: manual verification (after all stages are accepted)
Verify the whole lab end to end, the way the teacher will see it. For now through Swagger UI; once the project
has a frontend, run the same cases through the frontend instead.
1. **Write the test cases** in `docs/LAB_<N>_MANUAL_TESTS.md`, next to the acceptance criteria, in Polish.
   Derive them from `docs/LAB_<N>_ACCEPTANCE_CRITERIA.md`: every criteria row is covered by at least one case,
   including error paths (400/404/409/422). Format:
   - `# Laboratorium <N>: manualne scenariusze testowe` + one line on how to run (Swagger URL, DB used).
   - Per stage, `## Etap <N>.<k>` with a table
     `| ID | Wymaganie | Warunki wstępne | Kroki | Oczekiwany wynik | Wynik | Uwagi |`.
     IDs are `TC-<N>.<k>-<nn>`. Steps name the Swagger page and endpoint and give the exact request body.
     The expected result gives the status code and the key response fields. Leave `Wynik` empty for now.
2. **Ask the user to accept the test cases.** Adjust and ask again until they accept. Don't run anything before.
3. **Run them in a browser**: the Playwright MCP tools, or the built-in browser pane. Start the DB (`npm run db:up`) and the API on a
   throwaway database (as `capture-evidence.cjs` in the lab 1 report folder does), never on `appdb`. For each case,
   open the Swagger page, expand the endpoint, click "Try it out", fill in the parameters and body, click
   "Execute", and read the response code and body from the page. Prepare the preconditions through Swagger too.
   If neither browser is available, stop and tell the user instead of falling back to curl.
4. **Write the results into the same file**: fill `Wynik` with ✅ or ❌ and put the actual status and the
   relevant part of the body in `Uwagi`. Add a `## Podsumowanie` section at the end: date, number of passed and
   failed cases, and a list of fixes made.
5. **Fix failing cases.** For each ❌, decide whether the code or the case is wrong. Fix the code following
   `CLAUDE.md` and rerun `npm run lint`, `npm run typecheck` and `npm test`. A wrong case is changed only with the
   user's OK. Then rerun all cases, not only the failed ones, and update the results. Repeat until all pass.
   Record each fix in `Podsumowanie` (case ID, cause, changed files).
6. Show the user the summary and ask for acceptance. Commit code fixes as `<N>-fix: <summary>`, then the test file
   as `<N>: manual tests`. Don't push unless asked.

## Phase 3: report (only after the manual tests are accepted)
- Output: `docs/reports/sprawozdanie_projekt_<N>/Piotr_Zietek_SiRR_nst_sprawozdanie_projekt_<N>.docx`,
  with `assets/` and generator scripts in the same folder (mirror `docs/reports/sprawozdanie_projekt_1/`).
- Content: follow the table of contents from the lab's `imie_nazwisko_grupa_sprawozdanie_projekt_<N>.docx` exactly.
- Styling: match `docs/reports/sprawozdanie_projekt_1/Piotr_Zietek_SiRR_nst_sprawozdanie_projekt_1.docx`
  (fonts, colors, tables, code blocks, figure captions), with these rules taking precedence:
  - No page header at all. The footer contains only the page number, centred.
  - Title page author table filled in: Numer albumu 148585, Imię Piotr, Nazwisko Ziętek, Grupa SiRR.
  - No "Kod źródłowy: …" notes or other pointers to source files.
  - Few code snippets: only where a template point needs the code to make sense (e.g. a state machine definition,
    a key algorithm, a config the instruction asks for). Describe the rest in prose; never paste whole files.
  - Bibliography at the end, titled "Bibliografia": a bullet list of entries with links, nothing else (no intro
    text, no table of local materials).
- Reuse the lab 1 tooling as a starting point and copy it, don't edit it in place:
  - `capture-evidence.cjs`: runs the app on a throwaway DB and takes Swagger UI screenshots, writes `evidence.json`
  - `build-report.cjs`: builds the .docx with the `docx` library (style helpers `p/h/code/table/image`)
  - `inspect-pdf.cjs`, `preview-docx.cjs`: render and check the layout
  - These load `docx`, `sharp` and `playwright` from `%TEMP%/ztp-report-tools/node_modules`.
    Install there with `npm i --prefix "$TEMP/ztp-report-tools" docx sharp playwright` if missing.
- Typography: never use long dashes (— or –), only the short hyphen "-", also in ranges (e.g. "10-35 s") and
  in titles and captions. Check the built .docx for "—" and "–" before handing it over.
- Screenshots and outputs must come from real runs, never made up. Render the docx and check its layout before you hand it over.
- Ask for acceptance of the report, then commit it as `<N>: report`.
