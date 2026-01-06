import os
import json
import asyncio
import argparse
from pypdf import PdfReader
from google import genai
from google.genai import types

# Keep your Schema exactly the same
SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "account_holder": {"type": "STRING"},
        "statement_period": {"type": "STRING"},
        "total_ending_balance": {"type": "NUMBER"},
        "transactions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "date": {"type": "STRING"},
                    "description": {"type": "STRING"},
                    "amount": {"type": "NUMBER"},
                    "category": {"type": "STRING"}
                },
                "required": ["date", "description", "amount"]
            }
        }
    }
}

async def process_statement(pdf_path):
    # Initialize the ASYNC client using .aio
    client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
    
    # 1. Instant Text Extraction
    reader = PdfReader(pdf_path)
    raw_text = "\n".join([p.extract_text() for p in reader.pages])

    # 2. Use the .aio (Async I/O) namespace to allow 'await'
    # This is the secret to fixing your 'can't be used in await' error
    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"Extract transactions from this text:\n\n{raw_text}",
        config=types.GenerateContentConfig(
            system_instruction="Extract bank transactions into JSON precisely.",
            response_mime_type="application/json",
            response_schema=SCHEMA,
            temperature=0.0
        )
    )

    # 3. Save to JSON File
    output_filename = pdf_path.replace(".pdf", ".json")
    with open(output_filename, "w") as f:
        # response.text is directly accessible on the result object
        json.dump(json.loads(response.text), f, indent=4)
    
    return output_filename

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("filename")
    args = parser.parse_args()
    
    try:
        out_file = await process_statement(args.filename)
        print(f"✅ JSON saved: {out_file}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())