(() => {
  const { diseases, esc } = App;

  function draw(body, term) {
    const q = term.trim();
    const rows = diseases.rows.filter((d) => !q || d[0].includes(q) || d[1].includes(q)).map((d) => {
      const cells = diseases.columns.map((c) => `<td class="num">${esc(c.pay[d[c.index]] || "-")}</td>`).join("");
      return `<tr><th scope="row">${esc(d[0])}<div class="sub">${esc(d[1])}</div></th>${cells}</tr>`;
    }).join("");
    body.innerHTML = rows || `<tr><td colspan="${diseases.columns.length + 1}">ไม่พบในรายการ ไม่ได้แปลว่าไม่คุ้มครองแบบอื่น เช่น ค่ารักษาจากสัญญาสุขภาพ</td></tr>`;
  }

  function render(section) {
    const head = diseases.columns.map((c) => `<th>${esc(c.label)}</th>`).join("");
    section.innerHTML = `<input id="search" type="search" placeholder="พิมพ์ชื่อโรค เช่น มะเร็ง หัวใจ ไต">
      <div class="legend">ตัวเลขคือ % ของทุนประกันที่จ่ายต่อการเคลม ต้องตรงตามคำจำกัดความในสัญญา ชื่อโรคตรงกันไม่ได้แปลว่าเคลมได้เสมอ สัญญาเฉพาะมะเร็งดูในแท็บเปรียบเทียบผลิตภัณฑ์</div>
      <div class="tablewrap"><table class="matrix"><thead><tr><th>โรค / อาการ</th>${head}</tr></thead><tbody></tbody></table></div>`;
    const body = section.querySelector("tbody");
    section.querySelector("#search").addEventListener("input", (e) => draw(body, e.target.value));
    draw(body, "");
  }

  App.registerTab({ id: "disease", label: "ค้นโรค", render });
})();
