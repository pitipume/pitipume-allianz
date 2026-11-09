"""Validate data/ and generate site/data.js and sheet/coverage-template.xlsx from it.

Run from the project root: python3 scripts/build.py (needs openpyxl).
"""
import json
import shutil
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
FONT = "Arial"
MAX_POLICIES = 200
LOOKUP_ROWS = 15


def header(ws, labels, widths):
    ws.append(labels)
    for i, width in enumerate(widths, 1):
        cell = ws.cell(row=ws.max_row, column=i)
        cell.font = Font(name=FONT, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="1F4E79")
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.freeze_panes = f"A{ws.max_row + 1}"  # a string, so no empty row 2 gets created


def finish(wb):
    for ws in wb:
        for row in ws.iter_rows():
            for cell in row:
                if not cell.font.bold:
                    cell.font = Font(name=FONT, color=cell.font.color)
                cell.alignment = Alignment(wrap_text=True, vertical="top")


def resolve(products):
    """Fill "same" products from their base, as site/js/core.js does."""
    base = {p["code"]: p for p in products}
    out = []
    for p in products:
        if p.get("same"):
            b = base[p["same"]]
            conditions = [f'ค่าลดหย่อน: {p["deductible"]}'] + p.get("conditions", []) + b.get("conditions", [])
            p = {**b, **p, "conditions": conditions}
        out.append(p)
    return out


def benefit_rows(product):
    for b in product.get("benefits", []):
        if "pct" in b:
            yield b["l"], "", f'{b["pct"]}% ของทุน'
        elif isinstance(b["v"], dict):
            for plan, value in b["v"].items():
                if plan in product.get("plans", [plan]):
                    yield b["l"], plan, value
        else:
            yield b["l"], "", b["v"]


def build_workbook(data):
    products = resolve(data["products"])
    wb = Workbook()

    guide = wb.active
    guide.title = "คู่มือ"
    for line in [
        ["วิธีใช้"],
        ["กรอกเฉพาะแท็บ Customers และ Policies (ช่องสีเหลือง) แท็บอื่นสร้างจากโฟลเดอร์ data อย่าแก้โดยตรง"],
        ["แถว DEMO เป็นตัวอย่างสมมติ ลบออกก่อนใช้งานจริง"],
        ["ค้นลูกค้า: แท็บ Claim_Lookup พิมพ์ Customer ID ที่ช่อง B1"],
        ["ลิงก์แผน: กดคัดลอกลิงก์ในแท็บจัดแผนของเว็บ แล้ววางในคอลัมน์ Plan link ของ Customers ลิงก์ไม่มีชื่อลูกค้า"],
        [""],
        ["ความปลอดภัย (PDPA)"],
        ["ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหว ต้องได้รับความยินยอมโดยชัดแจ้งก่อนเก็บ และบันทึกวันที่ในคอลัมน์ Consent date"],
        ["ไฟล์นี้เมื่อมีข้อมูลจริงห้ามเผยแพร่ ห้ามแชร์แบบ anyone with link และห้าม commit ขึ้น GitHub เปิดบัญชีด้วยการยืนยันสองชั้น"],
        ["ไม่ต้องเก็บเลขบัตรประชาชนหรือประวัติการรักษาละเอียด เก็บเท่าที่จำเป็นต่อการบริการหลังการขาย"],
        [""],
        [f'ข้อมูลผลิตภัณฑ์ตรวจเมื่อ {data["checked"]} เงื่อนไขจริงเป็นไปตามกรมธรรม์ ระดับข้อมูล:'],
    ]:
        guide.append(line)
    for tier, text in data["tiers"].items():
        guide.append([f"{tier}: {text}"])
    guide.column_dimensions["A"].width = 110
    guide["A1"].font = Font(name=FONT, bold=True)
    guide["A7"].font = Font(name=FONT, bold=True)

    ws = wb.create_sheet("Products")
    header(ws, ["Code", "ชื่อ", "หมวด", "ระดับข้อมูล", "สรุป", "อายุรับประกัน", "ความคุ้มครอง", "ระยะรอคอย", "เงื่อนไข", "ข้อยกเว้น", "แหล่งข้อมูล",
                "ตัวอย่างเบี้ย", "เหมาะกับ", "ไม่เหมาะกับ"],
           [16, 38, 22, 8, 40, 20, 22, 22, 50, 40, 40, 50, 30, 30])
    categories = {c["id"]: c["name"] for c in data["categories"]}
    for p in products:
        source = data["sources"].get(p.get("src"), {})
        src = source.get("url") or source.get("title", "ยังไม่มี")
        ws.append([p["code"], p["name"], categories[p["cat"]], p["tier"], p.get("summary", ""), p.get("entry", "ดูสัญญาหลัก"),
                   p.get("cover", "ตามสัญญาหลัก"), p.get("waiting", ""), "\n".join(p.get("conditions", [])),
                   "\n".join(p.get("exclusions", [])), src, p.get("premiumExample", ""), p.get("fit", ""), p.get("unfit", "")])

    ws = wb.create_sheet("Benefits")
    header(ws, ["Code", "หมวดผลประโยชน์", "รายการ", "แผน", "จำนวน (บาท)"], [16, 26, 62, 10, 22])
    for p in products:
        for label, plan, value in benefit_rows(p):
            bucket = next(data["buckets"][b["b"]] for b in p["benefits"] if b["l"] == label)
            ws.append([p["code"], bucket, label, plan, value])

    ws = wb.create_sheet("Diseases")
    labels = [c["label"] for c in data["diseases"]["columns"]]
    header(ws, ["โรค / อาการ", "หมวด"] + labels, [58, 26] + [12] * len(labels))
    columns = data["diseases"]["columns"]
    for d in data["diseases"]["rows"]:
        ws.append([d[0], d[1]] + [c["pay"].get(str(d[c["index"]]), "-") for c in columns])

    yellow = PatternFill("solid", fgColor="FFF2CC")
    ws = wb.create_sheet("Customers")
    header(ws, ["Customer ID", "ชื่อ", "เบอร์ติดต่อ", "วันเกิด", "Consent date", "Plan link", "หมายเหตุบริการ"], [14, 26, 16, 14, 14, 40, 40])
    ws.append(["DEMO-001", "ลูกค้าตัวอย่าง (สมมติ)", "000-000-0000", "1990-01-01", "2026-10-31", "", "แถวตัวอย่าง ลบก่อนใช้งานจริง"])
    for row in ws.iter_rows(min_row=2, max_row=3):
        for cell in row:
            cell.fill = yellow

    ws = wb.create_sheet("Policies")
    header(ws, ["Customer ID", "เลขกรมธรรม์", "Product code", "แผน", "ทุน/วงเงิน", "วันเริ่มคุ้มครอง", "เบี้ย/ปี", "ชื่อผลิตภัณฑ์", "สรุป", "ระยะรอคอย", "Key"],
           [14, 18, 16, 10, 14, 16, 12, 38, 40, 24, 14])
    ws.append(["DEMO-001", "DEMO-POLICY", "HSMHPDC", "แผน 2", 15000000, "2026-10-31", 29916])
    for r in range(2, MAX_POLICIES + 2):
        for col in "ABCDEFG":
            ws[f"{col}{r}"].fill = yellow
        ws[f"H{r}"] = f'=IF(C{r}="","",IFERROR(INDEX(Products!$B:$B,MATCH(C{r},Products!$A:$A,0)),"ไม่พบรหัส"))'
        ws[f"I{r}"] = f'=IF(C{r}="","",IFERROR(INDEX(Products!$E:$E,MATCH(C{r},Products!$A:$A,0)),""))'
        ws[f"J{r}"] = f'=IF(C{r}="","",IFERROR(INDEX(Products!$H:$H,MATCH(C{r},Products!$A:$A,0))&"",""))'
        ws[f"K{r}"] = f'=IF(A{r}="","",A{r}&"|"&COUNTIF($A$2:A{r},A{r}))'
    codes = DataValidation(type="list", formula1=f"Products!$A$2:$A${len(products) + 1}", allow_blank=True)
    ws.add_data_validation(codes)
    codes.add(f"C2:C{MAX_POLICIES + 1}")

    ws = wb.create_sheet("Claim_Lookup")
    ws["A1"] = "Customer ID"
    ws["A1"].font = Font(name=FONT, bold=True)
    ws["B1"] = "DEMO-001"
    ws["B1"].fill = yellow
    ws["A2"] = "ชื่อ"
    ws["B2"] = '=IFERROR(INDEX(Customers!$B:$B,MATCH($B$1,Customers!$A:$A,0)),"ไม่พบลูกค้า")'
    ws["A3"] = "ลิงก์แผน"
    ws["B3"] = '=IFERROR(INDEX(Customers!$F:$F,MATCH($B$1,Customers!$A:$A,0))&"","")'
    ws.append([])
    header(ws, ["ลำดับ", "ผลิตภัณฑ์", "รหัส", "แผน", "ทุน/วงเงิน", "วันเริ่ม", "ระยะรอคอย", "สรุป"], [14, 40, 16, 10, 14, 14, 24, 44])
    first = ws.max_row + 1
    columns = {"B": "H", "C": "C", "D": "D", "E": "E", "F": "F", "G": "J", "H": "I"}
    for n in range(1, LOOKUP_ROWS + 1):
        r = first + n - 1
        ws[f"A{r}"] = n
        for target, source in columns.items():
            ws[f"{target}{r}"] = f'=IFERROR(INDEX(Policies!${source}:${source},MATCH($B$1&"|"&$A{r},Policies!$K:$K,0))&"","")'
    ws[f"A{first + LOOKUP_ROWS + 1}"] = "ค่ารักษาละเอียดดูจากลิงก์แผน หรือกรองแท็บ Benefits ตามรหัส ก่อนตอบลูกค้าให้ตรวจวันเริ่มเทียบระยะรอคอย"

    finish(wb)
    return wb


def load():
    data = json.loads((ROOT / "data/meta.json").read_text(encoding="utf-8"))
    data["diseases"] = json.loads((ROOT / "data/diseases.json").read_text(encoding="utf-8"))
    data["products"] = []
    for category in data["categories"]:
        data["products"] += json.loads((ROOT / f'data/products/{category["id"]}.json').read_text(encoding="utf-8"))
    return data


def validate(data):
    """Stop the build on data mistakes, so a bad entry never reaches the site."""
    errors = []
    if not isinstance(data.get("showUnconfirmed"), bool):
        errors.append("meta.json: showUnconfirmed must be true or false")
    codes = [p["code"] for p in data["products"]]
    errors += [f"duplicate code {c}" for c in {c for c in codes if codes.count(c) > 1}]
    categories = {c["id"] for c in data["categories"]}
    row_keys = {row[0] for group in data["compareGroups"] for row in group["rows"]}
    grouped = {c for group in data["compareGroups"] for c in group["cats"]}
    errors += [f"category {c} is in no compareGroup" for c in categories - grouped]
    expected = {f'{c}.json' for c in categories}
    extra = {f.name for f in (ROOT / "data/products").glob("*.json")} - expected
    errors += [f"data/products/{name} has no category in meta.json" for name in extra]
    for p in data["products"]:
        where = p["code"]
        for field in ("name", "cat", "tier", "summary"):
            if field not in p:
                errors.append(f"{where}: missing {field}")
        if p.get("cat") not in categories:
            errors.append(f'{where}: unknown cat {p.get("cat")}')
        if p.get("tier") not in data["tiers"]:
            errors.append(f'{where}: unknown tier {p.get("tier")}')
        if p.get("tier") != "D" and p.get("src") not in data["sources"]:
            errors.append(f"{where}: tier {p.get('tier')} needs a source")
        for ref in p.get("parent", []) + p.get("excludes", []) + ([p["same"]] if p.get("same") else []):
            if ref not in codes:
                errors.append(f"{where}: unknown product {ref}")
        for b in p.get("benefits", []):
            if not set(b.get("k", [])) or set(b.get("k", [])) - row_keys:
                errors.append(f'{where}: "{b["l"]}" needs k values from compareGroups rows')
            if b["b"] not in data["buckets"]:
                errors.append(f'{where}: unknown bucket {b["b"]}')
            if isinstance(b.get("v"), dict) and set(b["v"]) - set(p.get("plans", [])):
                errors.append(f'{where}: "{b["l"]}" uses a plan not in plans')
    if errors:
        raise SystemExit("Data errors:\n" + "\n".join(errors))


# Notes to the agent, never shown publicly. Also catches inferred codes.
PRIVATE_NOTES = ("สำหรับตัวแทน", "รายการของคุณ", "AZD", "อนุมาน", "ยังไม่ยืนยัน", "รหัสหน้าเว็บ", "ควรตรวจว่า", "ตารางไม่แสดง")


# A whole field value of exactly this is a fact customers can see, not an agent note.
UNCONFIRMED = "ยังไม่ยืนยัน"


def public_data(data):
    """Strip agent notes. Tier C/D become "D" so the site marks them unconfirmed, or are left out when showUnconfirmed is false."""
    products = []
    for product in data["products"]:
        if product["tier"] not in ("A", "B") and not data["showUnconfirmed"]:
            continue
        clean = {k: v for k, v in product.items() if k != "tier"}
        # The public page hides badges. Raising a product to A/B in data/ removes its mark.
        clean["tier"] = "A" if product["tier"] in ("A", "B") else "D"
        if "conditions" in clean:
            clean["conditions"] = [c for c in clean["conditions"] if not any(n in c for n in PRIVATE_NOTES)]
        products.append(clean)
    cats = {p["cat"] for p in products}
    groups = [{**g, "cats": [c for c in g["cats"] if c in cats]} for g in data["compareGroups"]]
    return {
        **data,
        "public": True,
        "products": products,
        "categories": [c for c in data["categories"] if c["id"] in cats],
        "compareGroups": [g for g in groups if g["cats"]],
        "tiers": {"A": "", "D": ""},
        "sources": {k: v for k, v in data["sources"].items() if k in {p.get("src") for p in products}},
    }


def strings(value):
    if isinstance(value, dict):
        for v in value.values():
            yield from strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from strings(v)
    elif isinstance(value, str):
        yield value


def build_public(data):
    target = ROOT / "public"
    shutil.rmtree(target, ignore_errors=True)
    shutil.copytree(ROOT / "site", target, ignore=shutil.ignore_patterns("data.js"))
    public = public_data(data)
    text = json.dumps(public, ensure_ascii=False)
    leaks = sorted({n for s in strings(public) if s != UNCONFIRMED for n in PRIVATE_NOTES if n in s})
    if leaks:
        raise SystemExit(f"Private notes in public data: {leaks}")
    (target / "data.js").write_text(f"window.DATA = {text};\n", encoding="utf-8")


def main():
    data = load()
    validate(data)
    (ROOT / "site/data.js").write_text(f"window.DATA = {json.dumps(data, ensure_ascii=False)};\n", encoding="utf-8")
    build_public(data)
    (ROOT / "sheet").mkdir(exist_ok=True)
    build_workbook(data).save(ROOT / "sheet/coverage-template.xlsx")
    print(f'{len(data["products"])} products, {len(data["diseases"]["rows"])} diseases')


if __name__ == "__main__":
    main()
