# drawing above the pdf
from reportlab.pdfgen import canvas
# getting the page size of the pdf
from reportlab.lib.pagesizes import A4


c = canvas.Canvas("report.pdf", pagesize=A4)
width, height = A4

c.setFont("Helvetica", 12)
c.drawString(100, height - 100, "This is a sample PDF report.")
c.setFont("Helvetica-Bold", 14)

students = [
    {"name": "Alice", "age": 20, "grade": "A"},
    {"name": "Bob", "age": 22, "grade": "B"},
]

for name, age, grade in [(s["name"], s["age"], s["grade"]) for s in students]:
    c.drawString(100, height - 150, f"Name: {name}, Age: {age}, Grade: {grade}")
    height -= 20

c.save()
print("PDF file 'report.pdf' has been created successfully.")