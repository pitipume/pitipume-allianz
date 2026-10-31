// Shared helpers and the tab registry. Tabs live in js/tabs/ and call App.registerTab.
window.App = (() => {
  const data = window.DATA;
  if (data.public) document.body.classList.add("customer", "public");
  const byCode = {};
  data.products.forEach((p) => { byCode[p.code] = p; });

  // "same" products reuse their base product and override only what differs.
  data.products.forEach((p) => {
    if (!p.same) return;
    const base = byCode[p.same];
    Object.keys(base).forEach((key) => { if (p[key] === undefined) p[key] = base[key]; });
    p.conditions = [`ค่าลดหย่อน: ${p.deductible}`, ...(base.conditions || [])];
  });

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const money = (n) => Number(n).toLocaleString("en-US");
  const badge = (t) => `<span class="badge t${t} agent" title="${esc(data.tiers[t])}">${t}</span>`;
  const list = (title, items) => (items && items.length ? `<h4>${title}</h4><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");

  // amount only applies to percent-of-sum-insured benefits.
  function cellValue(benefit, plan, amount) {
    if (benefit.pct) return amount ? money((amount * benefit.pct) / 100) : `${benefit.pct}% ของทุน`;
    if (typeof benefit.v === "object") return benefit.v[plan || Object.keys(benefit.v)[0]] || "-";
    return benefit.v;
  }

  // Short text for comparison cells; cv overrides input-driven values such as OPD limits.
  const benefitValue = (benefit, plan) => benefit.cv || cellValue(benefit, plan, 0);

  const tabs = [];
  // A tab is { id, label, render(section), onShow?() }.
  const registerTab = (tab) => tabs.push(tab);

  function show(id) {
    tabs.forEach((tab) => {
      document.getElementById(tab.id).hidden = tab.id !== id;
      document.querySelector(`[data-tab="${tab.id}"]`).classList.toggle("active", tab.id === id);
      if (tab.id === id && tab.onShow) tab.onShow();
    });
  }

  function start() {
    const nav = document.getElementById("tabs");
    const main = document.querySelector("main");
    nav.innerHTML = tabs.map((t) => `<button data-tab="${esc(t.id)}">${esc(t.label)}</button>`).join("");
    main.innerHTML = tabs.map((t) => `<section id="${esc(t.id)}" hidden></section>`).join("");
    tabs.forEach((t) => t.render(document.getElementById(t.id)));
    nav.addEventListener("click", (e) => { if (e.target.dataset.tab) show(e.target.dataset.tab); });
    document.getElementById("customerMode").addEventListener("change", (e) => document.body.classList.toggle("customer", e.target.checked));
    const opening = tabs.find((t) => t.opensFromUrl && t.opensFromUrl());
    show((opening || tabs[0]).id);
  }

  return { ...data, byCode, esc, money, badge, list, cellValue, benefitValue, registerTab, start };
})();
