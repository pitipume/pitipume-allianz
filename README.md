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

`scripts/build.py` also writes `public/`: official-source products only, with agent notes removed. Cloudflare Pages serves that folder, with no build command. Never point a host at `site/`. Run the build and commit `public/` after each data change.

## Add a product

Add an object to `data/products/<category>.json`, then run the build. The site, plan builder and spreadsheet pick it up. The build stops on a duplicate code, unknown parent, or a missing source.

Main fields: `code`, `name`, `cat`, `tier` (A-D), `src` (a key in `sources`), `summary`, `entry`, `cover`, `waiting`, `conditions`, `exclusions`, `plans`, `benefits`.
Plan rules: `parent` (needs one of these first), `excludes` (cannot sit with these), `same` (copy a product and override fields).
Amount inputs: `sa` (sum insured), `input` (label for a free amount).

A benefit is `{ "b": "<group>", "k": ["<row key>"], "l": "<label>", "v": "<text>" }`. `k` places it on a comparison row from `compareGroups` in `meta.json`, so products line up. One line can fill several rows. Add a new row there if needed. `compare` holds facts with no benefit line, such as `{ "pay": "6 ปี" }`, and `cv` is short cell text for values the user types in. Use `"v": { "<plan>": "<value>" }` for per-plan amounts, or `"pct": 100` for a percent of sum insured.

Add a category by adding it to `categories` in `meta.json` and creating its file. Add a disease-table contract with one entry in `columns` and one value per row in `diseases.json`.

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
