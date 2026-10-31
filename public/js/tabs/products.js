(() => {
  const { tiers, compareGroups, sources, products, checked, byCode, esc, badge, list, cellValue, benefitValue } = App;

  // Column ids hidden by the chips. Kept in memory only, so a refresh shows everything again.
  const hidden = new Set();

  const childrenOf = (p) => products.filter((x) => x.parent && x.parent.includes(p.code));

  function addOns(p, key, plan) {
    return childrenOf(p).flatMap((child) => {
      const own = (child.benefits || []).filter((b) => b.k.includes(key)).map((b) => `+ ${benefitValue(b, plan)}`);
      return [...own, ...addOns(child, key, plan)];
    });
  }

  function value(p, plan, key) {
    const own = (p.benefits || []).filter((b) => b.k.includes(key)).map((b) => benefitValue(b, plan));
    if (own.length) return own.join(" / ");
    if (p.compare && p.compare[key]) return p.compare[key];
    return addOns(p, key, plan).join(" หรือ ");
  }

  function columns(group) {
    return products.filter((p) => group.cats.includes(p.cat) && !p.parent).flatMap((p) => {
      const plans = p.plans || [null];
      return plans.map((plan) => ({ id: `${p.code}:${plan || ""}`, p, plan }));
    });
  }

  function detail(p) {
    const source = p.src ? `<p class="agent"><a href="${esc(sources[p.src].url)}" target="_blank" rel="noopener">แหล่งข้อมูล: ${esc(sources[p.src].title)}</a></p>` : "";
    const riders = childrenOf(p).map((c) => `${c.name} (${c.code}): ${c.summary}`);
    return `<div class="detail"><h3>${esc(p.name)} <span class="code">${esc(p.code)}</span></h3>
      <p>${esc(p.summary)}</p>
      ${p.fit ? `<p>เหมาะกับ: ${esc(p.fit)}</p>` : ""}${p.unfit ? `<p>ไม่เหมาะกับ: ${esc(p.unfit)}</p>` : ""}
      ${p.premiumExample ? `<p>ตัวอย่างเบี้ย: ${esc(p.premiumExample)}</p>` : ""}
      ${list("ซื้อเพิ่มได้", riders)}
      <div class="agent">${list("เงื่อนไขและหมายเหตุ", p.conditions)}</div>
      ${list("ตัวอย่างข้อยกเว้น", p.exclusions)}
      ${source}</div>`;
  }

  function matrix(group) {
    const cols = columns(group).filter((c) => !hidden.has(c.id));
    if (!cols.length) return "<p>เลือกอย่างน้อย 1 แบบด้านบน</p>";
    const unverified = (c) => (c.p.tier === "C" || c.p.tier === "D" ? " agent" : "");
    const head = cols.map((c) => `<th class="col${unverified(c)}"><button class="linklike" data-detail="${esc(c.p.code)}">${esc(c.p.name)}</button>
      ${c.plan ? `<div>${esc(c.plan)}</div>` : ""}<div class="code">${esc(c.p.code)} ${badge(c.p.tier)}</div></th>`).join("");
    const row = (label, get) => `<tr><th scope="row">${esc(label)}</th>${cols.map((c) => `<td class="num${unverified(c)}">${esc(get(c) || "—")}</td>`).join("")}</tr>`;
    const riders = cols.some((c) => childrenOf(c.p).length) ? [row("สัญญาเสริมที่ซื้อเพิ่มได้", (c) => childrenOf(c.p).map((r) => r.name).join(", "))] : [];
    const facts = [["อายุรับประกัน", "entry"], ["ความคุ้มครอง", "cover"], ["ระยะรอคอย", "waiting"]]
      .filter(([, field]) => cols.some((c) => c.p[field]))
      .map(([label, field]) => row(label, (c) => c.p[field]));
    const rows = group.rows.filter(([key]) => cols.some((c) => value(c.p, c.plan, key))).map(([key, label]) => row(label, (c) => value(c.p, c.plan, key)));
    return `<div class="tablewrap"><table class="matrix"><thead><tr><th class="corner">ผลประโยชน์</th>${head}</tr></thead><tbody>${riders.join("")}${rows.join("")}${facts.join("")}</tbody></table></div>`;
  }

  function chips(group, index) {
    return products.filter((p) => group.cats.includes(p.cat) && !p.parent).map((p) => {
      const ids = columns(group).filter((c) => c.p === p).map((c) => c.id);
      const on = !ids.every((id) => hidden.has(id));
      const hide = p.tier === "C" || p.tier === "D" ? " agent" : "";
      return `<label class="chip${hide}"><input type="checkbox" data-group="${index}" data-product="${esc(p.code)}"${on ? " checked" : ""}> ${esc(p.name)}</label>`;
    }).join("");
  }

  function drawGroup(card, index) {
    const group = compareGroups[index];
    card.querySelector(".matrixhost").innerHTML = matrix(group);
    card.querySelector(".detailhost").innerHTML = "";
  }

  function render(section) {
    const legend = Object.keys(tiers).map((t) => `<div>${badge(t)} ${esc(tiers[t])}</div>`).join("");
    section.innerHTML = `<div class="legend agent">ตรวจแหล่งข้อมูลเมื่อ ${esc(checked)}. กดชื่อแบบประกันเพื่อดูรายละเอียด${legend}</div>
      <div class="legend">จำนวนเงินเป็นบาท. "+" คือซื้อเพิ่มได้ "—" คือไม่มีข้อมูลรายการนี้ในเอกสารที่ตรวจ ไม่ได้แปลว่าไม่คุ้มครอง</div>
      ${compareGroups.map((g, i) => `<section class="group" data-index="${i}"><h2>${esc(g.name)}</h2>
        <div class="chips">${chips(g, i)}</div><div class="matrixhost"></div><div class="detailhost"></div></section>`).join("")}`;
    section.querySelectorAll(".group").forEach((card) => drawGroup(card, Number(card.dataset.index)));

    section.addEventListener("change", (e) => {
      const { group, product } = e.target.dataset;
      if (group === undefined) return;
      columns(compareGroups[group]).filter((c) => c.p.code === product).forEach((c) => {
        if (e.target.checked) hidden.delete(c.id); else hidden.add(c.id);
      });
      drawGroup(e.target.closest(".group"), Number(group));
    });

    section.addEventListener("click", (e) => {
      const code = e.target.dataset.detail;
      if (!code) return;
      const host = e.target.closest(".group").querySelector(".detailhost");
      host.innerHTML = host.dataset.open === code ? "" : detail(byCode[code]);
      host.dataset.open = host.dataset.open === code ? "" : code;
    });
  }

  App.registerTab({ id: "products", label: "เปรียบเทียบผลิตภัณฑ์", render });
})();
