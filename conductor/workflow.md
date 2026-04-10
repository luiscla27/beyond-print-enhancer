# Project Workflow

## Guiding Principles

1. **The Plan is our shared guide:** All work should be tracked in `plan.md`
2. **The Tech Stack is intentional:** Changes to the tech stack are documented in `tech-stack.md` before starting implementation.
3. **Commit Early, Commit Often:** Small, focused commits make it easier to understand the evolution of the project.
4. **Test-Driven Development (TDD):** We aim to write tests that define the expected behavior before implementing new features or fixing bugs.
5. **Human-in-the-Loop:** We value user feedback and verification at every stage of the development process.
6. **Self-Correcting:** If we find an issue, we document it, fix it, and verify the solution.
7. **Selector Centralization:** We prefer moving all CSS selectors to DomManager with corresponding unit tests.

## Guidance Protocols

- **Interactive Feedback:** When using `ask_user` to gather feedback or confirm decisions, we always provide at least one option for "Detailed Alternative", "Other", or "Revise with Comments" instead of just binary "Yes/No" choices. This ensures the user can provide specific course corrections.
- **Verification:** When a task involves a visual or behavioral change, we provide a manual verification plan.

## Task Workflow

For each task in `plan.md`, we follow this sequence:

1.  **Mark Task as 'In Progress':** Update the task's status from `[ ]` to `[~]` in `plan.md`.
2.  **Research and Plan:** Analyze the task requirements and determine the implementation strategy.
3.  **Write Failing Tests (Red Phase):**
    - Identify or create the appropriate test file in `test/unit/`.
    - Write a test case that describes the expected behavior of the task.
    - **Note:** Run the tests and confirm that they fail as expected. This is the "Red" phase of TDD. Proceed once you have the baseline failing tests.
4.  **Implement the Task (Green Phase):**
    - Write the minimum amount of code necessary to make the tests pass.
    - Follow the coding style and architectural patterns established in the project.
5.  **Verify Implementation (Refactor Phase):**
    - Run the tests again to ensure they pass.
    - Refactor the code for clarity, efficiency, and maintainability while keeping the tests passing.
6.  **Update Plan:** Update the task's status from `[~]` to `[x]` in `plan.md`.
7.  **Commit Changes:**
    - **CRITICAL:** ALWAYS run all `mocha` tests and ensure they pass before performing any `git commit`. Never commit broken code.
    - Stage the changed files and `plan.md`.
    - Commit with a descriptive message following the Conventional Commits format.
    - Example: `feat(ui): add 'Add Shape' button to controls`
8.  **Record Commit SHA:** Append the first 7 characters of the commit hash to the completed task in `plan.md`.
9.  **Checkpointing:** If the task concludes a phase, proceed to the "Phase Completion Verification and Checkpointing" process.

### Phase Completion Verification and Checkpointing

**Trigger:** This step is initiated after a task is completed that concludes a phase in `plan.md`.

1.  **Announce Phase Completion:** Inform the user that the phase is ready for verification.
2.  **Verify Technical Integrity:**
    -   **Step 2.1: Determine Phase Scope:** To identify the files changed in this phase, find the starting point by reading `plan.md` for the Git commit SHA of the previous phase's checkpoint. If no previous checkpoint exists, the scope is all changes since the first commit.
    -   **Step 2.2: Identify Relevant Tests:**
        -   List all files changed in the current phase.
        -   For each code file, locate its corresponding test file in `test/unit/`.
        -   **Note:** First, check its extension. Exclude non-code files.
        -   If a test file is missing, please create one. Before writing the test, analyze other test files in the repository to determine the preferred naming convention and style. The new tests should validate the functionality described in this phase's tasks.
    -   **Step 2.3: Execute Tests:**
        -   Before execution, please announce the shell command you will use to run the tests.
        -   Run all relevant unit tests identified in Step 2.2.
        -   If tests fail, please inform the user and begin debugging. We suggest proposing a fix a maximum of two times. If the tests still fail, please report the status and ask for guidance.
3.  **Verify Behavioral Correctness:**
    -   **Step 3.1: Generate Manual Verification Plan:**
        -   **Note:** To generate the plan, analyze `product.md`, `product-guidelines.md`, and `plan.md` to determine the user-facing goals.
        -   Please generate a step-by-step plan that walks the user through the verification process, including any necessary commands and specific, expected outcomes.
        -   The verification plan should follow this format:
            ```markdown
            ### Manual Verification Plan - <Phase Name>
            
            1.  **<Action 1>:** <Description of the action the user should take>
                - **Expected Result:** <Description of what the user should see or experience>
            2.  **<Action 2>:** ...
            ```
    -   **Step 3.2: Solicit User Feedback:** Use the `ask_user` tool to present the manual verification plan and ask for confirmation.
4.  **Checkpoint and Record Phase SHA:**
    -   Once the user approves the phase, finalize the `plan.md` by ensuring all tasks in the phase are marked `[x]`.
    -   Stage and commit any remaining documentation changes (like updating the plan).
    -   Record the final commit SHA of the phase in `plan.md` as the checkpoint for the next phase.

## Release Workflow

When the project is ready for a new version:

1. **Review CHANGELOG:** Ensure all changes are documented.
2. **Increment Version:** Update `version` in `manifest.json` and `package.json`.
3. **Run Final Tests:** Execute the full test suite.
4. **Create Tag:** Create a Git tag for the new version.
5. **Build Artifact:** Create a production build (zip file).

## Quality Standards

- **Linting:** We use ESLint to ensure code consistency.
- **Testing:** We aim for high test coverage for core logic and UI components.
- **Documentation:** We keep the product definition and technical documentation in sync with the code.
- [ ] **UI Isolation & Deep Clean:** All new floating UI elements MUST be explicitly excluded from the "Deep Clean" rules in `js/main.js`. Use the `print-enhance-` prefix for IDs and `be-` for classes.
- [ ] **JSON Schema Versioning:** If the JSON structure for exported layouts has changed, the `SCHEMA_VERSION` in `js/main.js` should be incremented.

## Coding Style

### General
- Keep functions small and focused.
- Use meaningful variable and function names.
- Avoid global variables where possible.
- Use `const` and `let` instead of `var`.

### JavaScript
- Use ES6+ features where supported by modern browsers.
- Follow the project's directory structure for organization.
- We aim for every module to have corresponding tests.

### HTML/CSS
- Use semantic HTML elements.
- Prefer CSS variables for shared values.
- Keep CSS rules scoped to prevent side effects.

## Troubleshooting

### Debugging Steps
1. Review console logs for errors.
2. Check network requests if applicable.
3. Run tests to isolate the issue.
4. Use browser developer tools to inspect the DOM and styles.

### Persistent Failures
- If an issue cannot be resolved after two attempts, document the findings and ask the user for guidance.

### Urgent Bug in Production
1. Identify the issue
2. Create a reproduction test
3. Implement the fix
4. Verify with tests
5. Deploy promptly

### Security Incident
1. Rotate all secrets promptly
2. Audit access logs
3. Patch vulnerabilities
4. Communicate with stakeholders

### Performance Degradation
1. Profile the application
2. Identify bottlenecks
3. Optimize code or assets
4. Verify improvements

### CI/CD Failure
1. Check build logs
2. Identify the failing step
3. Fix the underlying issue
4. Rerun the pipeline

### Deployment Issue
1. Roll back to previous version if necessary
2. Analyze deployment logs
3. Fix the issue
4. Redeploy

### Browser Compatibility Issue
1. Test across supported browsers
2. Use feature detection or polyfills
3. Provide fallbacks where necessary
4. Update documentation

### Technical Debt
1. Identify areas for improvement
2. Create tasks in the backlog
3. Refactor during relevant feature work
4. Balance new features with maintenance

### User Feedback
1. Categorize feedback
2. Prioritize based on impact
3. Incorporate into the roadmap
4. Communicate updates to users

### Project Health
1. Monitor test coverage
2. Track bug count
3. Review dependencies regularly
4. Ensure documentation is up-to-date

### Collaboration
1. Use clear and concise communication
2. Review each other's work
3. Share knowledge within the team
4. Foster a positive and inclusive environment

### Documentation
1. Keep the README informative
2. Update the CHANGELOG regularly
3. Document core architectural decisions
4. Provide guides for contributors

### Continuous Learning
1. Stay up-to-date with industry trends
2. Share interesting articles or tools
3. Experiment with new technologies
4. Reflect on and improve our workflow

### Project Success
1. Deliver value to users
2. Maintain high quality standards
3. Foster a sustainable development pace
4. Celebrate our achievements together

### Conclusion
- Follow the plan
- Keep it simple
- Communicate effectively
- Value quality
- Learn and improve

## Maintenance

### Weekly Review
1. Check for outdated dependencies
2. Review open issues and PRs
3. Audit test coverage
4. Update the roadmap

### Feedback Loop
1. Monitor user issues
2. Gather user feedback
3. Plan next iteration

## Continuous Improvement

- Review workflow weekly
- Update based on pain points
- Document lessons learned
- Optimize for user happiness
- Keep things simple and maintainable
