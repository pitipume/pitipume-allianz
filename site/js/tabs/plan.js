(() => {
  const { buckets, categories, compareGroups, products, byCode, esc, money, badge, cellValue, benefitValue } = App;

  const PLAN_NAMES = ["แผน A", "แผน B", "แผน C"];
  const rowLabels = {};
  compareGroups.forEach((g) => g.rows.forEach(([key, label]) => { rowLabels[key] = label; }));

  // plans[i][code] = { plan, amount, premium }. It lives in the URL hash, so nothing leaves the browser.
  let plans = PLAN_NAMES.map(() => ({}));
  let active = 0;
  let root;

  const state = () => plans[active];

  function readHash() {
    plans = PLAN_NAMES.map(() => ({}));
    const m = location.hash.match(/plan=([^&]*)/);
    if (!m) return;
    decodeURIComponent(m[1]).split("~").slice(0, PLAN_NAMES.length).forEach((text, i) => {
      text.split(";").filter(Boolean).forEach((item) => {
        const [code, plan, amount, premium] = item.split("|");
        if (byCode[code]) plans[i][code] = { plan, amount: Number(amount) || 0, premium: Number(premium) || 0 };
      });
    });
  }

  function writeHash() {
    const text = plans.map((p) => Object.keys(p).map((c) => [c, p[c].plan || "", p[c].amount || "", p[c].premium || ""].join("|")).join(";")).join("~");
    history.replaceState(null, "", text.replace(/~/g, "") ? `#plan=${encodeURIComponent(text)}` : location.pathname);
  }

  const unlocked = (p) => !p.parent || p.parent.some((c) => state()[c]);

  function deselect(code) {
    if (!state()[code]) return;
    delete state()[code];
    products.filter((p) => state()[p.code] && !unlocked(p)).forEach((p) => deselect(p.code));
  }

  function select(code) {
    const p = byCode[code];
    const category = categories.find((c) => c.id === p.cat);
    if (category.rule === "one" && !p.parent) {
      products.filter((x) => x.cat === p.cat && !x.parent && x.code !== code).forEach((x) => deselect(x.code));
    }
    (p.excludes || []).forEach(deselect);
    state()[code] = { plan: p.plans ? p.plans[0] : "", amount: 0, premium: 0 };
  }

  function pickRow(p, c) {
    const s = state()[p.code];
    const attrs = (field) => `data-field="${field}" data-code="${esc(p.code)}"`;
    const inputs = !s ? "" : `<div class="inputs">
      ${p.plans ? `<label>แผน <select ${attrs("plan")}>${p.plans.map((x) => `<option${x === s.plan ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label>` : ""}
      ${p.sa ? `<label>ทุน <input type="number" min="0" ${attrs("amount")} value="${s.amount || ""}"></label>` : ""}
      ${p.input ? `<label>${esc(p.input)} <input type="number" min="0" ${attrs("amount")} value="${s.amount || ""}"></label>` : ""}
      <label>เบี้ย/ปี (ถ้าทราบ) <input type="number" min="0" ${attrs("premium")} value="${s.premium || ""}"></label>
    </div>`;
    const type = c.rule === "one" && !p.parent ? "radio" : "checkbox";
    return `<div class="pick${p.parent ? " child" : ""}"><label><input type="${type}" name="${esc(c.id)}" data-code="${esc(p.code)}"${s ? " checked" : ""}> ${esc(p.name)} ${badge(p.tier)}</label>${inputs}</div>`;
  }

  // Every value one plan gives for a (bucket, key) row, tagged with its code when two contracts add to it.
  function valuesFor(plan, bucket, key) {
    const found = [];
    Object.keys(plan).forEach((code) => {
      const p = byCode[code];
      const s = plan[code];
      (p.benefits || []).filter((b) => b.b === bucket && b.k.includes(key)).forEach((b) => {
        const chosen = b.v === "ตามวงเงินที่เลือก" && s.amount ? money(s.amount) : b.pct && s.amount ? cellValue(b, s.plan, s.amount) : benefitValue(b, s.plan);
        found.push({ name: p.name, chosen });
      });
    });
    return found.length > 1 ? found.map((f) => `${f.chosen} (${f.name})`).join(" + ") : (found[0] || {}).chosen || "";
  }

  function compareTable() {
    const used = plans.map((p, i) => ({ p, i })).filter(({ p }) => Object.keys(p).length);
    if (!used.length) return "<p>เลือกสัญญาด้านบน ตารางเปรียบเทียบจะแสดงตรงนี้</p>";
    const head = used.map(({ i }) => `<th class="col">${PLAN_NAMES[i]}</th>`).join("");
    const contracts = `<tr><th scope="row">สัญญาในแผน</th>${used.map(({ p }) => `<td class="num">${Object.keys(p).map((c) => `${esc(byCode[c].name)}${p[c].plan ? ` ${esc(p[c].plan)}` : ""}`).join("<br>")}</td>`).join("")}</tr>`;
    const keys = Object.keys(rowLabels);
    const body = Object.keys(buckets).map((bucket) => {
      const rows = keys.map((key) => {
        const cells = used.map(({ p }) => valuesFor(p, bucket, key));
        if (!cells.some(Boolean)) return "";
        return `<tr><th scope="row">${esc(rowLabels[key])}</th>${cells.map((c) => `<td class="num">${esc(c || "—")}</td>`).join("")}</tr>`;
      }).join("");
      return rows ? `<tr class="band"><th colspan="${used.length + 1}">${esc(buckets[bucket])}</th></tr>${rows}` : "";
    }).join("");
    const total = (p) => Object.values(p).reduce((sum, s) => sum + s.premium, 0);
    const missing = (p) => Object.values(p).filter((s) => !s.premium).length;
    const premium = `<tr class="band"><th colspan="${used.length + 1}">เบี้ยประกัน</th></tr>
      <tr class="total"><th scope="row">รวมต่อปี</th>${used.map(({ p }) => `<td class="num">${money(total(p))}${missing(p) ? `<div class="sub">ยังไม่กรอก ${missing(p)} รายการ</div>` : ""}</td>`).join("")}</tr>`;
    return `<div class="tablewrap"><table class="matrix"><thead><tr><th class="corner">ผลประโยชน์</th>${head}</tr></thead><tbody>${contracts}${body}${premium}</tbody></table></div>`;
  }

  function warnings() {
    const out = [];
    plans.forEach((plan, i) => {
      const chosen = Object.keys(plan).map((c) => byCode[c]);
      if (!chosen.length) return;
      if (!chosen.some((p) => p.cat === "life")) out.push(`${PLAN_NAMES[i]}: ยังไม่ได้เลือกสัญญาหลัก`);
      const unverified = chosen.filter((p) => p.tier === "C" || p.tier === "D").map((p) => p.code);
      if (unverified.length) out.push(`${PLAN_NAMES[i]}: ยังไม่ยืนยันจากเอกสารทางการ ${unverified.join(", ")}`);
    });
    return out.map((w) => `<div class="warn agent">${esc(w)}</div>`).join("");
  }

  function draw() {
    const pickers = categories.map((c) => `<div class="picker"><h3>${esc(c.name)}${c.rule === "one" ? " (เลือก 1)" : ""}</h3>${
      products.filter((p) => p.cat === c.id && unlocked(p)).map((p) => pickRow(p, c)).join("")}</div>`).join("");
    const switcher = PLAN_NAMES.map((name, i) => `<button data-plan="${i}" class="${i === active ? "on" : ""}">${name}</button>`).join("");
    root.innerHTML = `<div class="actions"><span class="switcher">${switcher}</span><button id="copyLink">คัดลอกลิงก์</button><button id="printPlan">พิมพ์ / PDF</button><button id="clearPlan">ล้าง ${PLAN_NAMES[active]}</button></div>
      ${warnings()}${compareTable()}
      <details class="pickers" open><summary>เลือกสัญญาสำหรับ ${PLAN_NAMES[active]}</summary><div class="pickergrid">${pickers}</div></details>`;
  }

  function render(section) {
    root = section;
    readHash();
    draw();
    root.addEventListener("change", (e) => {
      const { code, field } = e.target.dataset;
      if (!code) return;
      if (field) state()[code][field] = field === "plan" ? e.target.value : Number(e.target.value) || 0;
      else if (e.target.checked) select(code);
      else deselect(code);
      writeHash();
      draw();
    });
    root.addEventListener("click", (e) => {
      if (e.target.dataset.plan !== undefined) {
        active = Number(e.target.dataset.plan);
        draw();
      } else if (e.target.id === "copyLink") {
        navigator.clipboard.writeText(location.href).then(() => { e.target.textContent = "คัดลอกแล้ว"; });
      } else if (e.target.id === "printPlan") {
        window.print();
      } else if (e.target.id === "clearPlan") {
        plans[active] = {};
        writeHash();
        draw();
      }
    });
  }

  const opensFromUrl = () => location.hash.includes("plan=");

  App.registerTab({ id: "plan", label: "เปรียบเทียบแผนลูกค้า", render, opensFromUrl });
})();
