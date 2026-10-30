import time
import json
import os

from flask import Flask, jsonify, request, send_from_directory
from google import genai
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder="static")

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=API_KEY) if API_KEY else None

POSITIONS = {
    "Python Developer",
    "Web Developer",
    "Data Analyst",
    "Java Developer",
    "Software Developer",
    "HR Executive"
}

TOTAL_QUESTIONS = 6


def ai_json(instructions, payload):
    if client is None:
        raise RuntimeError("Gemini API key is missing. Check your .env file.")
    start_time = time.time()
    response = client.models.generate_content(
        model=MODEL,
        contents=(
            "Return only valid JSON. Be concise. "
            "Do not use Markdown. "
            + json.dumps(payload, ensure_ascii=False)
        ),
        config={
            "system_instruction": instructions,
            "response_mime_type": "application/json",
            "max_output_tokens": 1200,
            "thinking_config": {
                "thinking_budget": 0
            }
        }
    )
    print("Gemini response time:", round(time.time() - start_time, 2), "seconds")

    response_text = (response.text or "").strip()

    if not response_text:
        raise RuntimeError("Gemini returned an empty response.")

    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        start = response_text.find("{")
        end = response_text.rfind("}")

        if start != -1 and end > start:
            return json.loads(response_text[start:end + 1])

        raise RuntimeError("Gemini returned an invalid JSON response.")

@app.get("/")
def home():
    return app.send_static_file("index.html")


@app.get("/api/health")
def health():
    return jsonify({
        "ok": True,
        "ai_configured": client is not None,
        "model": MODEL
    })


@app.post("/api/start")
def start_interview():
    data = request.get_json(silent=True) or {}
    position = str(data.get("position", "")).strip()

    if position not in POSITIONS:
        return jsonify({"error": "Please choose a valid job position."}), 400

    try:
        result = ai_json(
            """
You are InterviewIQ AI.

Generate one short, relevant interview question
for a student or fresher applying for the given role.

Return JSON with:
question: string
difficulty: "Easy"
category: string
welcome: short welcome message

Keep everything concise.

            """,
            {
                "position": position,
                "question_number": 1,
                "total_questions": TOTAL_QUESTIONS
            }
        )

        if not result.get("question"):
            raise RuntimeError("Gemini did not generate an interview question.")

        return jsonify({
            "position": position,
            "question": str(result["question"]),
            "difficulty": result.get("difficulty", "Medium"),
            "category": result.get("category", "Role knowledge"),
            "welcome": result.get(
                "welcome",
                f"Welcome to your {position} mock interview!"
            )
        })

    except Exception as exc:
        app.logger.exception("Could not start interview")
        return jsonify({"error": str(exc)}), 502


@app.post("/api/answer")
def answer():
    data = request.get_json(silent=True) or {}

    position = str(data.get("position", "")).strip()
    question = str(data.get("question", "")).strip()
    answer_text = str(data.get("answer", "")).strip()

    try:
        question_number = int(data.get("question_number", 1))
    except (TypeError, ValueError):
        question_number = 1

    history = data.get("history", [])
    previous_results = data.get("previous_results", [])

    if position not in POSITIONS:
        return jsonify({"error": "Please choose a valid job position."}), 400

    if not question or not answer_text:
        return jsonify({"error": "Please enter an answer."}), 400

    if len(answer_text) > 6000:
        return jsonify({"error": "Your answer exceeds 6,000 characters."}), 400

    if question_number < 1 or question_number > TOTAL_QUESTIONS:
        return jsonify({"error": "Invalid interview question number."}), 400

    is_last = question_number == TOTAL_QUESTIONS

    try:
        instructions = """
        You are InterviewIQ AI, an experienced and fair mock interviewer.

        Evaluate the candidate's latest answer for the selected job position.

        Give an honest score from 0 to 100.
        Consider correctness, relevance, clarity and practical understanding.
        Be encouraging but do not give undeserved high scores.
        Keep feedback concise and useful.

        If the interview is not complete:
        - Generate exactly one next interview question.
        - Adapt its difficulty based on the candidate's previous answers.
        - Avoid repeating earlier questions.
        - Keep the question relevant to the selected job.

        If the interview is complete:
        - Do not generate another question.
        - Prepare a final performance report.
        - Include strengths, weaknesses and practical improvement suggestions.

        Return valid JSON using these keys:

        evaluation:
          score: integer from 0 to 100
          feedback: short string
          strengths: array of short strings

        is_complete: boolean

        next_question: string or empty string
        next_difficulty: Easy, Medium, or Hard
        next_category: string

        report:
          overall_score: integer from 0 to 100
          summary: string
          strengths: array of strings
          weaknesses: array of strings
          improvement_suggestions: array of strings
          category_feedback: object with Technical Knowledge,
            Problem Solving and Communication keys
          next_steps: string

        For an incomplete interview, report can be an empty object.
        For a completed interview, provide the full report.
        """

        result = ai_json(
            instructions,
            {
                "position": position,
                "current_question_number": question_number,
                "total_questions": TOTAL_QUESTIONS,
                "current_question": question,
                "candidate_answer": answer_text,
                "interview_history": history,
                "previous_evaluations": previous_results,
                "interview_complete": is_last
            }
        )

        evaluation = result.get("evaluation", {})

        if not isinstance(evaluation, dict):
            raise RuntimeError("Gemini did not return a valid evaluation.")

        score = max(0, min(100, int(evaluation.get("score", 0))))

        response_data = {
            "evaluation": {
                "score": score,
                "feedback": str(evaluation.get("feedback", "Answer evaluated.")),
                "strengths": evaluation.get("strengths", [])
            },
            "is_complete": is_last
        }

        if is_last:
            report = result.get("report", {})

            if not isinstance(report, dict):
                report = {}

            response_data["report"] = report

        else:
            next_question = result.get("next_question", "")

            if not next_question:
                raise RuntimeError("Gemini did not generate the next question.")

            response_data.update({
                "next_question": str(next_question),
                "next_difficulty": result.get("next_difficulty", "Medium"),
                "next_category": result.get("next_category", "Role knowledge")
            })

        return jsonify(response_data)

    except Exception as exc:
        app.logger.exception("Could not process interview answer")
        return jsonify({"error": str(exc)}), 502


if __name__ == "__main__":
    app.run(debug=True)
