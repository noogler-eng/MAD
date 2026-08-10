import csv

with open("students.csv", "r") as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        # csv reading always gives us the value as string, so we need to convert it to int
        row['age'] = int(row['age'])
        print(f"Name: {row['name']}, Age: {row['age']}, Grade: {row['grade']}")

print("CSV file 'students.csv' has been read successfully.")