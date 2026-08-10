from pypdf import PdfReader

reader = PdfReader("report.pdf")
print(f"Number of pages: {len(reader.pages)}")

for page_num, page in enumerate(reader.pages):
    text = page.extract_text()
    print(f"Page {page_num + 1} content:\n{text}\n")
    print(f"Page {page_num + 1} size: {page.mediabox.width} x {page.mediabox.height}\n")

print("PDF file 'report.pdf' has been read successfully.")    

# simillary we can extract tables data from the pdf
import pdfplumber

# automatically extract tables from the pdf
# with automaically closes the file
with pdfplumber.open("report.pdf") as pdf:
    first_page = pdf.pages[0] 

    text = first_page.extract_text()
    print(f"Page {page_num + 1} text: {text}")

    tables = first_page.extract_tables()
    print(f"Page {page_num + 1} tables:")
    
    for table in tables:
        for row in table:
            print(row)
        print("\n")