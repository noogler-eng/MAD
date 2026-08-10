# python built-in csv module
import csv

students = [
    {"name": "Alice", "age": 20, "grade": "A"},
    {"name": "Bob", "age": 22, "grade": "B"},
]

with open("students.csv", "w", newline="") as csvfile:
    fieldnames = ["name", "age", "grade"]
    # writting csv file using DictWriter
    # making an object of DictWriter class and 
    # passing the file object and fieldnames to it
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

    writer.writeheader()
    for student in students:
        writer.writerow(student)


print("CSV file 'students.csv' has been created successfully.")