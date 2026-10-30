# InterviewIQ AI

A deployable AI mock-interview website. Candidates select a job position, answer six adaptive questions, and receive a personalised report with a score, strengths, weaknesses, and improvement suggestions.

## Features

- Position-specific interviews: Python Developer, Web Developer, Data Analyst, Java Developer, Software Developer, HR Executive
- AI-generated questions and answer evaluation
- Adaptive follow-up difficulty
- Final report with overall score, strengths, weaknesses, and next steps
- API key stays on the server
- Single Flask app serves both frontend and API, making deployment simpler

## Requirements

- Python 3.10 or newer
- An OpenAI API key with API access and available billing/quota

## Run locally on Windows

1. Extract the ZIP and open the `InterviewIQ_AI` folder in VS Code.
2. Open Terminal in VS Code.
3. Create a virtual environment:

   ```powershell
   py -3.12 -m venv .venv
   ```

   If Python 3.12 is not installed, use `py -m venv .venv`.

4. Install dependencies:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

5. Copy `.env.example` to a new file named `.env`.
6. Open `.env` and replace `put_your_api_key_here` with your API key. Do not share the key or commit `.env` to GitHub.
7. Start the server:

   ```powershell
   .\.venv\Scripts\python.exe app.py
   ```

8. Open http://127.0.0.1:5000 in your browser.

If PowerShell blocks virtual-environment activation, these commands avoid activation entirely.

## Deploy on Render

1. Create a GitHub repository and upload the project files. Do **not** upload `.env`.
2. In Render, create a new Web Service and connect the repository.
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn app:app`
5. Add environment variables in Render:
   - `OPENAI_API_KEY` = your private API key
   - `OPENAI_MODEL` = `gpt-5.5` (or another model enabled for your API account)
6. Deploy. Render will provide a public URL.

The included `render.yaml` can also be used as a Render Blueprint.

## Important notes

- OpenAI API usage may incur charges and is separate from a ChatGPT subscription. Check your API account's billing and limits.
- This prototype keeps interview state in the browser and does not save candidate reports to a database.
- The score is AI-generated practice feedback, not a validated hiring assessment.
- For a public production deployment, add rate limiting, abuse protection, secure session handling, privacy/retention notices, and monitoring before inviting unrestricted users.
