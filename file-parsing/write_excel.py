# library to read and write excel files
import openpyxl

# making a excel in memory, default sheet
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Students"

ws.append(["Name", "Age", "Grade"])
students = [
    {"name": "Alice", "age": 20, "grade": "A"},
    {"name": "Bob", "age": 22, "grade": "B"},
]

for student in students:
    ws.append([student["name"], student["age"], student["grade"]])

wb.save("students.xlsx")
print("Excel file 'students.xlsx' has been created successfully.")