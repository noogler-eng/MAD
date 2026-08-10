# File Parsing in Python — CSV, Excel, PDF

Hands-on learning project: CSV, Excel (`.xlsx`), aur PDF ko Python se **read aur write** karna —
format-specific libraries use karke (pandas jaisa unified tool nahi, taaki har format ke internals
alag-alag samjhein).

## Table of Contents

- [Setup](#setup)
- [Why Format-Specific Libraries (Not pandas)](#why-format-specific-libraries-not-pandas)
- [CSV](#csv)
- [Excel (.xlsx)](#excel-xlsx)
- [PDF](#pdf)
- [Concepts Learned](#concepts-learned)
- [Gotchas / Debugging Notes](#gotchas--debugging-notes)
- [Exercises](#exercises)

---

## Setup

```bash
cd /Users/sharadpoddar/Desktop/MAD/file-parsing
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

| Library | Kaam |
|---|---|
| `csv` | Python **built-in** — install nahi karna padta. CSV read/write. |
| `openpyxl` | Excel (`.xlsx`) read/write |
| `pypdf` | PDF se text **extract** karna |
| `pdfplumber` | PDF ke andar se **tables** extract karna (pypdf tables mein weak hai) |
| `reportlab` | Naya PDF **generate** karna (canvas-based drawing) |

---

## Why Format-Specific Libraries (Not pandas)

`pandas` ek unified interface deta hai (`pd.read_csv()`, `pd.read_excel()` — dono ek jaisi API se
kaam karte hain), jo real-world data-heavy projects mein fast/convenient hota hai. Yahan jaan-boojh
kar **format-specific libraries** (`csv`, `openpyxl`, `pypdf`) use kiye — kyunki inse **internals
better samajh aate hain**: CSV quoting rules, Excel ki row/column/cell model, PDF ka
position-based text layout. Ye foundational samajh aage kabhi bhi (chahe pandas use karo ya kuch aur)
kaam aayegi.

---

## CSV

**Files:** `write_csv.py`, `read_csv.py`

### Kyun `csv` module, `.split(',')` nahi
```csv
name,city,note
Sharad,"Mumbai, India","Says ""hello"" often"
```
Agar value ke andar hi comma ho (`"Mumbai, India"`) ya quotes ho (`""hello""`), `.split(',')` galat
tod dega. `csv` module ye **quoting/escaping rules** correctly handle karta hai.

### Writing (`write_csv.py`)
`csv.DictWriter` use kiya — dictionaries ki list ko directly rows mein convert karta hai:
```python
writer = csv.DictWriter(csvfile, fieldnames=fieldnames)  # fieldnames = column order define karta hai
writer.writeheader()   # pehli row — column names
writer.writerow(student)  # ek dict = ek row
```

### Reading (`read_csv.py`)
`csv.DictReader` — har row ko dictionary ki tarah deta hai (column name → value):
```python
reader = csv.DictReader(csvfile)
for row in reader:
    row['age'] = int(row['age'])  # IMPORTANT: CSV mein sab kuch STRING hota hai
```

---

## Excel (.xlsx)

**Files:** `write_excel.py`, `read_excel.py`

### Internally Kya Hai
`.xlsx` file actually ek **ZIP archive** hai jisके andar XML files hoti hain (sheets, styles, sab
XML mein encode hote hain). `openpyxl` is complexity ko chhupa deta hai — Workbook/Worksheet/Cell
jaise simple Python objects milte hain.

### Writing (`write_excel.py`)
```python
wb = openpyxl.Workbook()   # naya, khaali workbook memory mein
ws = wb.active             # default sheet
ws.title = "Students"      # naam badla
ws.append(["Name", "Age", "Grade"])   # header row
ws.append([student["name"], student["age"], student["grade"]])  # data row
wb.save("students.xlsx")   # disk pe save
```

### Reading (`read_excel.py`)
```python
wb = openpyxl.load_workbook("students.xlsx", data_only=True)  # data_only — formula ka RESULT chahiye, formula string nahi
ws = wb["Students"]                     # sheet naam se access
for row in ws.iter_rows(min_row=2, values_only=True):  # min_row=2 — header row skip
    name, age, grade = row
```

---

## PDF

**Files:** `write_pdf.py`, `read_pdf.py`

### Reading aur Writing Do Alag Problems Hain
PDF ek **fixed-layout, print-oriented format** hai — "rows/columns" ka structured-data concept
nahi hota jaisa CSV/Excel mein. Isliye:
- **Writing** = canvas pe (x, y) position pe text "draw" karna (jaise painting)
- **Reading** = text ko position ke hisaab se wapas nikalna (order kabhi-kabhi mix ho sakta hai)

### Writing (`write_pdf.py`)
```python
c = canvas.Canvas("report.pdf", pagesize=A4)   # naya canvas, A4 size
width, height = A4                              # A4 ki actual width/height (points mein)
c.drawString(100, height - 100, "text")         # (x, y) position — PDF mein Y-axis NEECHE se UPAR jaata hai (origin bottom-left)
c.save()                                        # PDF finalize + disk pe save
```

> **Y-axis gotcha:** Web/mobile UI mein Y neeche badhta hai (top-left origin). PDF mein **Y upar
> badhta hai** (bottom-left origin) — isliye "page ke neeche likhna" matlab `height` se **subtract**
> karna hai, add nahi.

### Reading text (`read_pdf.py` — pypdf)
```python
reader = PdfReader("report.pdf")
for page in reader.pages:
    text = page.extract_text()   # is page ka text nikalne ki koshish
```
> **Gotcha:** `extract_text()` layout preserve nahi karta — agar text columns/tables mein tha,
> extraction order mix ho sakta hai.

### Reading tables (`read_pdf.py` — pdfplumber)
```python
with pdfplumber.open("report.pdf") as pdf:   # context manager — block khatam hote hi file auto-close
    first_page = pdf.pages[0]
    tables = first_page.extract_tables()     # specifically table-like grid structures dhoondta hai
```
> Humara `report.pdf` plain text lines hai (koi grid/border structure nahi), isliye `extract_tables()`
> khaali list dega — real table wale PDF (bank statement, invoice) pe try karo to actual tables milenge.

---

## Concepts Learned

1. **CSV mein sab STRING hota hai** — `row["age"]` `"20"` dega, `20` nahi. Explicit `int()`/`float()`
   conversion zaroori hai, warna `"20" + "22"` string concatenation karega (`"2022"`), addition nahi.
2. **`csv`/`openpyxl` quoting/escaping automatically handle karte hain** — manual `.split(',')` fragile
   hai jaise hi data mein commas/quotes ho.
3. **Excel formulas vs values** — `openpyxl` bina `data_only=True` ke formula ka TEXT dega
   (`'=IF(...)'`), result nahi. Aur `data_only=True` bhi tabhi kaam karta hai jab file kabhi Excel mein
   khul ke save hui ho (jisse formula evaluate ho chuki ho) — pure Python se banayi-save ki file mein
   formula result cache nahi hota, `None` milega.
4. **PDF ka coordinate system inverted hai** — origin bottom-left, Y upar badhta hai. Isse "page ke
   neeche likhna" ka matlab hai height se subtract karna.
5. **PDF text extraction lossy hai** — layout/structure guarantee nahi hoti jaisa CSV/Excel mein
   hoti hai, kyunki PDF fundamentally ek "visual" format hai, "data" format nahi.
6. **Reading aur writing ke liye alag libraries kyun** — kyunki "PDF padhna" (existing binary parse
   karna) aur "PDF banana" (fresh canvas pe draw karna) bilkul different problems hain — koi single
   library dono equally well nahi karti, isliye `pypdf`/`pdfplumber` (read) vs `reportlab` (write) alag hain.

---

## Gotchas / Debugging Notes

| Symptom | Wajah |
|---|---|
| CSV mein number field pe `TypeError` ya galat addition | Value abhi bhi string hai, `int()`/`float()` convert nahi kiya |
| Excel se padhte waqt formula cell `None` ya formula-text milta hai | `data_only=True` missing, ya file kabhi Excel mein khul ke save nahi hui |
| PDF mein text galat jagah/order mein extract ho raha hai | `extract_text()` ki inherent limitation — layout-heavy PDFs ke liye `pdfplumber` ya position-aware extraction try karo |
| `extract_tables()` khaali list de raha hai | PDF mein actual grid/table structure nahi hai (sirf plain text lines hai) — ye library ka bug nahi, PDF mein table hi nahi hai |
| PDF mein text overlap ho raha hai (upar wali line ke upar likha) | Y position manually decrement nahi kiya loop mein — har `drawString` call ke baad `height -= <kuch value>` karna zaroori hai |

---

## Exercises

1. `students.csv` padho aur ek naya CSV banao jisme sirf `grade == "A"` wale students hain
2. `students.xlsx` mein ek naya column "Pass/Fail" add karo (age ke bajaye grade ke hisaab se — Excel
   formula se, jaisa original `write_excel.py` extend karke)
3. `report.pdf` mein students ko naam ke alphabetical order mein print karo
