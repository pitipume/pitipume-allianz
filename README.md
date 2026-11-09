# Coverage Compare

Personal agent tool for comparing Allianz Ayudhya products, building a customer plan, and answering after-sales questions. Not an official company site.

## Structure

```
data/meta.json          categories, confidence tiers, benefit groups, sources
data/products/<cat>.json  one file per category
data/diseases.json      disease list and which contract pays what
scripts/build.py        validates data/, then generates the two files below
site/data.js            generated, do not edit
sheet/coverage-template.xlsx  generated, do not edit
site/js/core.js         helpers and tab registry
site/js/tabs/*.js       one file per tab
```

## Run

```
python3 -m venv .venv && .venv/bin/pip install openpyxl
.venv/bin/python scripts/build.py   # after any change in data/
open site/index.html                # no server needed
```

## Deploy

`scripts/build.py` also writes `public/`, with agent notes removed. `showUnconfirmed` in `data/meta.json` controls tier C/D products: `true` shows them, `false` leaves them out of `public/` entirely, so their data isn't shipped at all. `site/` always has every product. When shown, tier C/D products show a "ยังไม่ยืนยัน" (unconfirmed) mark, a tinted column and a warning in the plan builder. When a brochure or the real contract confirms a product, fill in its data and raise its `tier` to A or B. The mark then disappears on the next build, with no site code change. Cloudflare Pages serves that folder, with no build command. Never point a host at `site/`. Run the build and commit `public/` after each data change.

## Add a product

Add an object to `data/products/<category>.json`, then run the build. The site, plan builder and spreadsheet pick it up. The build stops on a duplicate code, unknown parent, or a missing source.

Main fields: `code`, `name`, `cat`, `tier` (A-D), `src` (a key in `sources`), `summary`, `entry`, `cover`, `waiting`, `conditions`, `exclusions`, `plans`, `benefits`.
Optional: `premiumExample` (premium example quoted from the brochure), `fit` and `unfit` (who it suits), `noRiders: true` (main contract that takes no riders; the plan builder warns).
Plan rules: `parent` (needs one of these first), `excludes` (cannot sit with these), `same` (copy a product and override fields).
Amount inputs: `sa` (sum insured), `input` (label for a free amount).

A benefit is `{ "b": "<group>", "k": ["<row key>"], "l": "<label>", "v": "<text>" }`. `k` places it on a comparison row from `compareGroups` in `meta.json`, so products line up. One line can fill several rows. Add a new row there if needed. `compare` holds facts with no benefit line, such as `{ "pay": "6 ปี" }`, and `cv` is short cell text for values the user types in. Use `"v": { "<plan>": "<value>" }` for per-plan amounts, or `"pct": 100` for a percent of sum insured.

Add a category by adding it to `categories` in `meta.json` and creating its file. `"main": true` marks a main-contract category (life, saving): a plan holds one main contract across all of them. Add a disease-table contract with one entry in `columns` and one value per row in `diseases.json`.

## Add a tab

Create `site/js/tabs/x.js` and add one `<script>` line to `index.html`:

```js
App.registerTab({ id: "x", label: "ชื่อแท็บ", render(section) { section.innerHTML = "..."; } });
```

Add the class `agent` to anything customers should not see in customer mode.

## Rules

- Never put customer names, health details or policy numbers in `site/` or `data/`. The site is a static public page. Customer data belongs in the private Google Sheet.
- Give every number a tier and a source. Tier D means no verified numbers yet.
- Re-check tier A sources when the company issues new brochures.
- Brochures from AZD go in `brochure/`, which git ignores. Never commit it: it can hold internal agent-only documents.
- Facts that come only from an internal agent document start with `สำหรับตัวแทน:` in `conditions`. The build strips them from `public/`, so they show on the agent site and in the spreadsheet only.
- A source with an empty `url` is a brochure file with no public link. It shows as text.
