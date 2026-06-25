# Open Source Prep Checklist

## engram (Rust Knowledge Base)

### Critical (Must-Have)
- [ ] Run full test suite: `cargo test --all`
- [ ] Fix any failing tests
- [ ] Add installation instructions for macOS/Linux/Windows
- [ ] Document environment variables (JINA_API_KEY)
- [ ] Add CONTRIBUTING.md
- [ ] Add LICENSE (MIT?)
- [ ] Clean up any TODOs or FIXMEs in code
- [ ] Remove any hardcoded paths or secrets
- [ ] Add `.gitignore` for Rust (target/, Cargo.lock for libs)

### Important (Should-Have)
- [ ] Add examples/ directory with sample usage
- [ ] Document all CLI commands with examples
- [ ] Add architecture diagram (ASCII or Mermaid)
- [ ] Performance benchmarks
- [ ] Add GitHub Actions CI (test + build)
- [ ] Add issue templates
- [ ] Add code of conduct

### Nice-to-Have
- [ ] Docker file for easy deployment
- [ ] Homebrew formula
- [ ] Pre-built binaries for releases
- [ ] Video demo or GIF
- [ ] Comparison with alternatives (vector DBs)

---

## grain (TypeScript AI Agent)

### Critical (Must-Have)
- [ ] Global find/replace: "molt" → "grain" (remaining instances)
- [ ] Global find/replace: "MoltConfig" → "GrainConfig"
- [ ] Update package.json description
- [ ] Add installation instructions (npm, bun)
- [ ] Document all CLI commands
- [ ] Add CONTRIBUTING.md
- [ ] Add LICENSE (MIT?)
- [ ] Remove any API keys or secrets from code
- [ ] Clean up temporary test files
- [ ] Add proper .gitignore
- [ ] Test `npm install -g` flow

### Important (Should-Have)
- [ ] Add examples/ directory
- [ ] Document skills system
- [ ] Document knowledge graph format
- [ ] Add architecture diagram (link to ARCHITECTURE.md)
- [ ] Add GitHub Actions CI (build + test)
- [ ] Add issue templates
- [ ] Code of conduct
- [ ] Badges in README (npm version, build status, license)

### Nice-to-Have
- [ ] Record 5-min demo video
- [ ] Create animated GIF of skills system
- [ ] Docker file
- [ ] VS Code extension scaffolding
- [ ] Comparison table with Cursor/Aider/Continue

---

## Priority Order

**Today (3-4 hours):**

1. **engram tests** (1 hour)
   - Run `cargo test --all`
   - Fix any failures
   - Document how to run tests

2. **engram documentation** (30 min)
   - Installation steps
   - Environment variables
   - Examples

3. **grain cleanup** (1 hour)
   - molt → grain rename (remaining)
   - Remove test files
   - Clean .gitignore

4. **grain documentation** (30 min)
   - Installation (npm)
   - CLI commands
   - Skills examples

5. **Both: Add LICENSE + CONTRIBUTING** (30 min)

6. **Test installation flows** (30 min)
   - engram: `cargo install --path .`
   - grain: `npm install -g .`

**Tomorrow:**
- Launch content (video, blog, tweets)
- Competitive analysis

---

## Commands to Run

### engram
```bash
cd ~/engram
cargo test --all              # Run all tests
cargo clippy --all           # Lint
cargo build --release        # Build
./target/release/engram --help  # Test binary
```

### grain
```bash
cd ~/grain
bun run build                # Build
bun test                     # Run tests (if any)
npm pack                     # Test npm package
npm install -g .             # Test global install
grain --version              # Test binary
```

---

## Let's start!

What do you want to tackle first?

A) engram tests (run + fix)
B) molt → grain rename (final cleanup)
C) Documentation (README improvements)
D) All of the above in sequence
