const $ = (id) => document.getElementById(id);
const homeScreen = $("home-screen");
const interviewScreen = $("interview-screen");
const reportScreen = $("report-screen");
const messages = $("chat-messages");
let state = { position: "", question: "", questionNumber: 1, difficulty: "Medium", category: "Role knowledge", history: [], results: [] };

function show(screen) {
  [homeScreen, interviewScreen, reportScreen].forEach(s => s.classList.add("hidden"));
  screen.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function addMessage(kind, text, label, tag) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${kind}`;
  const labelEl = document.createElement("div");
  labelEl.className = "message-label";
  labelEl.textContent = label || (kind === "ai" ? "INTERVIEWIQ AI" : "YOUR ANSWER");
  wrapper.appendChild(labelEl);
  if (tag) {
    const tagEl = document.createElement("div");
    tagEl.className = "difficulty-tag";
    tagEl.textContent = tag;
    wrapper.appendChild(tagEl);
  }
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrapper.appendChild(bubble);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
  return wrapper;
}
function addFeedback(evaluation) {
  const wrapper = document.createElement("div");
  wrapper.className = "message ai";
  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = "QUICK FEEDBACK";
  const bubble = document.createElement("div");
  bubble.className = "inline-feedback";
  const strengths = Array.isArray(evaluation.strengths) ? evaluation.strengths.slice(0,2).join("; ") : "";
  bubble.textContent = `Score: ${evaluation.score}/100. ${evaluation.feedback || ""}${strengths ? " Strength: " + strengths : ""}`;
  wrapper.append(label, bubble);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}
function updateProgress() {
  $("progress-text").textContent = `Question ${state.questionNumber} of 6`;
  $("progress-bar").style.width = `${(state.questionNumber / 6) * 100}%`;
}
function setBusy(busy, message = "") {
  $("send-button").disabled = busy;
  $("start-button").disabled = busy;
  $("answer-input").disabled = busy;
  $("status-message").textContent = message;
  $("send-button").innerHTML = busy ? "Thinking <span>…</span>" : 'Send answer <span>↑</span>';
}
async function postJSON(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}
$("setup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  state = { position: $("position").value, question: "", questionNumber: 1, difficulty: "Medium", category: "Role knowledge", history: [], results: [] };
  $("role-name").textContent = state.position;
  messages.replaceChildren();
  $("answer-input").value = "";
  $("char-count").textContent = "0 / 6000";
  $("status-message").textContent = "";
  show(interviewScreen);
  setBusy(true, "Preparing your role-specific interview…");
  try {
    const data = await postJSON("/api/start", { position: state.position });
    state.question = data.question;
    state.difficulty = data.difficulty || "Medium";
    state.category = data.category || "Role knowledge";
    addMessage("ai", data.welcome || `Welcome to your ${state.position} interview. Let's begin.`, "INTERVIEWIQ AI");
    addMessage("ai", state.question, `QUESTION 1 · ${state.category}`, state.difficulty);
    updateProgress();
    $("answer-input").focus();
  } catch (error) {
    show(homeScreen);
    alert(error.message);
  } finally {
    setBusy(false);
  }
});
$("answer-input").addEventListener("input", () => {
  $("char-count").textContent = `${$("answer-input").value.length} / 6000`;
});
$("answer-form").addEventListener("submit", async (event) => {
  console.log("Answer form submitted!");
  event.preventDefault();
  const answerText = $("answer-input").value.trim();
  if (!answerText) return;
  const currentQuestion = state.question;
  const currentNumber = state.questionNumber;
  addMessage("user", answerText);
  state.history.push({ question_number: currentNumber, category: state.category, difficulty: state.difficulty, question: currentQuestion, answer: answerText });
  $("answer-input").value = "";
  $("char-count").textContent = "0 / 6000";
  setBusy(true, "Evaluating your answer and adapting the interview…");
  try {
    const data = await postJSON("/api/answer", {
      position: state.position,
      question: currentQuestion,
      answer: answerText,
      question_number: currentNumber,
      history: state.history,
      previous_results: state.results
    });
    state.results.push({ question_number: currentNumber, question: currentQuestion, answer: answerText, ...data.evaluation });
    addFeedback(data.evaluation);
    if (data.is_complete) {
      renderReport(data.report || {});
      show(reportScreen);
      return;
    }
    state.questionNumber += 1;
    state.question = data.next_question;
    state.difficulty = data.next_difficulty || "Medium";
    state.category = data.next_category || "Role knowledge";
    updateProgress();
    addMessage("ai", state.question, `QUESTION ${state.questionNumber} · ${state.category}`, state.difficulty);
    $("answer-input").focus();
  } catch (error) {
    $("status-message").textContent = error.message + " Your answer is still in the chat. You can retry by submitting it again.";
    // Restore the answer to avoid losing work if the request fails.
    $("answer-input").value = answerText;
    $("char-count").textContent = `${answerText.length} / 6000`;
    state.history.pop();
    const last = messages.lastElementChild;
    if (last && last.classList.contains("user")) last.remove();
  } finally {
    setBusy(false);
  }
});
function safeList(items, fallback) {
  const list = Array.isArray(items) ? items.filter(x => typeof x === "string" && x.trim()).slice(0, 6) : [];
  const values = list.length ? list : [fallback];
  const ul = document.createElement("ul");
  ul.className = "report-list";
  values.forEach(item => { const li = document.createElement("li"); li.textContent = item; ul.appendChild(li); });
  return ul;
}
function renderReport(report) {
  const container = $("report-content");
  container.replaceChildren();
  const score = Math.max(0, Math.min(100, Number(report.overall_score) || 0));
  const scoreCard = document.createElement("div");
  scoreCard.className = "report-score-card";
  scoreCard.innerHTML = `<div class="score-circle" style="--score:${score}%"><div><strong>${score}</strong><span>OUT OF 100</span></div></div><div><div class="score-title">Your interview snapshot</div><div class="score-summary"></div></div>`;
  scoreCard.querySelector(".score-summary").textContent = report.summary || "Your interview is complete. Use the feedback below to plan your next practice session.";
  container.appendChild(scoreCard);

  const grid = document.createElement("div");
  grid.className = "report-grid";
  const cards = [
    { title: "Your strengths", icon: "✓", className: "strength-card", items: report.strengths, fallback: "Review the answers where you scored highest." },
    { title: "Growth opportunities", icon: "↗", className: "weakness-card", items: report.weaknesses, fallback: "Practise explaining your reasoning with specific examples." },
    { title: "Improvement plan", icon: "✦", className: "", items: report.improvement_suggestions, fallback: "Complete another practice session after reviewing the role's core concepts." }
  ];
  cards.forEach(card => {
    const el = document.createElement("div");
    el.className = `report-card ${card.className}`;
    const heading = document.createElement("h3");
    heading.innerHTML = `<span class="icon">${card.icon}</span>`;
    heading.appendChild(document.createTextNode(card.title));
    el.appendChild(heading);
    el.appendChild(safeList(card.items, card.fallback));
    grid.appendChild(el);
  });
  const categoryCard = document.createElement("div");
  categoryCard.className = "report-card";
  const heading = document.createElement("h3");
  heading.innerHTML = '<span class="icon">◎</span>Skill breakdown';
  categoryCard.appendChild(heading);
  const categories = report.category_feedback && typeof report.category_feedback === "object" ? report.category_feedback : {};
  const defaults = { "Technical Knowledge": "Review role-specific fundamentals.", "Problem Solving": "Explain your steps and trade-offs.", "Communication": "Use concise, structured explanations." };
  Object.keys(defaults).forEach(key => {
    const row = document.createElement("div");
    row.className = "category-row";
    const strong = document.createElement("strong"); strong.textContent = key;
    const span = document.createElement("span"); span.textContent = categories[key] || defaults[key];
    row.append(strong, span); categoryCard.appendChild(row);
  });
  grid.appendChild(categoryCard);
  const nextSteps = document.createElement("div");
  nextSteps.className = "report-card";
  const nextHeading = document.createElement("h3");
  nextHeading.innerHTML = '<span class="icon">➜</span>What to do next';
  const nextText = document.createElement("p");
  nextText.className = "score-summary";
  nextText.textContent = report.next_steps || "Practise the suggested topics, then try another interview.";
  nextSteps.append(nextHeading, nextText);
  grid.appendChild(nextSteps);
  container.appendChild(grid);
}
function returnHome() {
  show(homeScreen);
  $("status-message").textContent = "";
}
$("back-home").addEventListener("click", returnHome);
$("review-home").addEventListener("click", returnHome);
$("try-again").addEventListener("click", () => {
  $("position").value = state.position;
  returnHome();
});
