"use strict";

const units = [
  {
    id: "3",
    title: "알고리즘과 프로그래밍",
    theme: "violet",
    description: "문제를 해결할 절차를 설계하고, 컴퓨터가 실행할 프로그램으로 표현해요.",
    keywords: ["추상화", "순서도", "엔트리"],
    cover: "assets/jump-game.webp",
    coverPage: "90",
    coverAlt: "캐릭터가 장애물을 뛰어넘는 교과서 게임 삽화"
  },
  {
    id: "5",
    title: "디지털 문화",
    theme: "teal",
    description: "디지털 기술이 삶과 직업을 어떻게 바꾸는지 보고, 온라인에서 지킬 약속을 알아봐요.",
    keywords: ["디지털 사회", "디지털 윤리", "저작권"],
    cover: "assets/digital-city.webp",
    coverPage: "200",
    coverAlt: "여러 시대의 모습을 잇는 디지털 도시 교과서 삽화"
  }
];

const main = document.querySelector("main");
const dialog = document.querySelector("#image-dialog");
const cache = new Map();
const previewData = document.querySelector("#preview-data");
const embedded = previewData ? JSON.parse(previewData.textContent) : null;
let navigation = 0;
let currentLesson = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(href, text, className) {
  const node = element("a", className, text);
  node.href = href;
  return node;
}

function routeFor(unit, view) {
  return "#" + unit.id + (view ? "/" + view : "");
}

function setPage(content, theme, title) {
  main.className = theme ? "theme-" + theme : "";
  main.replaceChildren(content);
  document.title = title ? title + " | 정보 복습실" : "정보 복습실";
}

function focusPage() {
  window.scrollTo(0, 0);
  const heading = main.querySelector("h1");
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

async function loadText(path) {
  if (embedded?.text[path] !== undefined) return embedded.text[path];
  if (!cache.has(path)) {
    const response = await fetch(path);
    if (!response.ok) throw new Error("자료를 불러올 수 없음");
    cache.set(path, await response.text());
  }
  return cache.get(path);
}

function imagePath(path) {
  return embedded?.images[path] || path;
}

function appendInline(parent, text) {
  for (const piece of text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)) {
    if (piece.startsWith("**") && piece.endsWith("**") && piece.length > 4) {
      parent.append(element("strong", "", piece.slice(2, -2)));
    } else if (piece.startsWith("`") && piece.endsWith("`") && piece.length > 2) {
      parent.append(element("code", "", piece.slice(1, -1)));
    } else {
      parent.append(document.createTextNode(piece));
    }
  }
}

function textbookFigure(source, alternative, credit) {
  const figure = element("figure", "textbook-figure");
  const zoom = element("button", "zoom-image");
  zoom.type = "button";
  zoom.setAttribute("aria-label", alternative + " 확대");
  const picture = element("img");
  picture.src = imagePath(source);
  picture.alt = alternative;
  picture.loading = "lazy";
  picture.decoding = "async";

  const caption = element("figcaption");
  caption.append(element("span", "", alternative), element("span", "figure-credit", credit));
  zoom.append(picture);
  figure.append(zoom, caption);
  zoom.addEventListener("click", () => {
    const enlarged = dialog.querySelector("img");
    enlarged.src = picture.src;
    enlarged.alt = alternative;
    dialog.querySelector("p").textContent = alternative + " · " + credit;
    dialog.showModal();
  });
  return figure;
}

function lessonSections(markdown) {
  const sections = [];
  let container = null;
  let list = null;
  let gallery = null;

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      list = null;
      gallery = null;
      continue;
    }

    if (line.startsWith("## ")) {
      const title = line.slice(3);
      const id = "topic-" + (sections.length + 1);
      container = element("section", "topic");
      container.id = id;
      container.setAttribute("aria-labelledby", id + "-heading");
      const heading = element("h2", "", title);
      heading.id = id + "-heading";
      heading.tabIndex = -1;
      container.append(heading);
      sections.push({ id, title, container, heading });
      list = null;
      gallery = null;
      continue;
    }

    if (!container) continue;
    const illustration = line.match(/^!\[([^\]]+)\]\((assets\/[\w.-]+) "([^"]+)"\)$/);
    if (illustration) {
      if (!gallery) {
        gallery = element("div", "figure-grid");
        container.append(gallery);
      }
      gallery.append(textbookFigure(illustration[2], illustration[1], illustration[3]));
      list = null;
      continue;
    }
    gallery = null;

    const bullet = line.match(/^(-|\d+\.) (.+)$/);
    if (bullet) {
      const tag = bullet[1] === "-" ? "ul" : "ol";
      if (!list || list.localName !== tag) {
        list = element(tag);
        container.append(list);
      }
      const item = element("li");
      appendInline(item, bullet[2]);
      list.append(item);
      continue;
    }
    list = null;

    const isHeading = line.startsWith("### ");
    const isNote = line.startsWith("> ");
    const block = element(isHeading ? "h3" : isNote ? "aside" : "p", isNote ? "study-note" : "");
    appendInline(block, isHeading ? line.slice(4) : isNote ? line.slice(2) : line);
    container.append(block);
  }
  if (!sections.length) throw new Error("소주제가 없음");
  return sections;
}

function showHome() {
  const page = element("div", "wrap home");
  const hero = element("section", "hero");
  const copy = element("div", "hero-copy");
  copy.append(
    element("p", "eyebrow", "중학교 1학년 정보"),
    element("h1", "", "정보 수업\n한 번 더"),
    element("p", "hero-description", "다시 보고 싶은 단원을 골라 핵심 개념을 읽고, 연습문제로 확인해 보세요.")
  );
  const art = element("div", "hero-art");
  art.setAttribute("aria-hidden", "true");
  art.append(
    element("span", "orbit orbit-one"),
    element("span", "orbit orbit-two"),
    element("span", "art-spark", "✦"),
    element("span", "art-dot"),
    element("span", "art-tile art-code", "{ }"),
    element("span", "art-tile art-check", "✓"),
    element("span", "art-tile art-flow", "◇")
  );
  hero.append(copy, art);

  const choices = element("section", "unit-choices");
  choices.setAttribute("aria-labelledby", "unit-choices-heading");
  const heading = element("h2", "", "학습할 단원");
  heading.id = "unit-choices-heading";
  const grid = element("div", "unit-grid");
  for (const unit of units) {
    const card = element("article", "unit-card theme-" + unit.theme);
    const visual = element("figure", "card-image");
    const picture = element("img");
    picture.src = imagePath(unit.cover);
    picture.alt = unit.coverAlt;
    visual.append(picture, element("figcaption", "", "교과서 " + unit.coverPage + "쪽"));

    const body = element("div", "card-body");
    const title = element("h3");
    title.append(link(routeFor(unit), unit.title, "unit-title"));
    const tags = element("ul", "keyword-list");
    tags.setAttribute("aria-label", "주요 개념");
    tags.append(...unit.keywords.map(word => element("li", "", word)));
    body.append(
      element("p", "unit-label", unit.id + "단원"),
      title,
      element("p", "unit-description", unit.description),
      tags,
      link(routeFor(unit), "핵심 개념 보기", "button button-primary card-action")
    );
    card.append(visual, body);
    grid.append(card);
  }
  choices.append(heading, grid);
  page.append(hero, choices);
  setPage(page);
}

function pageHeading(unit, mode) {
  const header = element("div", "page-heading");
  const back = mode === "quiz"
    ? link(routeFor(unit), "단원으로 돌아가기", "back-link")
    : link("#", "전체 단원", "back-link");

  header.append(
    back,
    element("p", "eyebrow", mode === "quiz" ? unit.id + "단원 · " + unit.title : unit.id + "단원"),
    element("h1", "", mode === "quiz" ? "연습문제" : unit.title),
    element("p", "page-description", mode === "quiz"
      ? "모든 문항의 답을 고르고 채점하면, 정답과 해설을 볼 수 있어요."
      : unit.description)
  );
  return header;
}

function moveToTopic(topics, topicId) {
  const section = topics.find(topic => topic.id === topicId);
  for (const navLink of main.querySelectorAll(".lesson-index a")) {
    if (navLink.dataset.topic === section?.id) {
      navLink.setAttribute("aria-current", "location");
    } else {
      navLink.removeAttribute("aria-current");
    }
  }
  if (section) {
    section.heading.focus({ preventScroll: true });
    section.container.scrollIntoView();
  } else {
    focusPage();
  }
}

function showLesson(unit, markdown, topicId) {
  const topics = lessonSections(markdown);
  const page = element("div", "wrap interior");
  const layout = element("div", "lesson-layout");
  const sidebar = element("nav", "lesson-index");
  sidebar.setAttribute("aria-label", "소주제 목차");
  const index = element("ol");
  for (const topic of topics) {
    const item = element("li");
    const topicLink = link(routeFor(unit, topic.id), topic.title);
    topicLink.dataset.topic = topic.id;
    item.append(topicLink);
    index.append(item);
  }
  sidebar.append(element("p", "index-title", "이 단원에서 배울 내용"), index);

  const lesson = element("article", "lesson");
  const practice = element("section", "practice-card");
  const practiceText = element("div");
  practiceText.append(
    element("h2", "", "배운 내용 확인하기"),
    element("p", "", "연습문제를 풀고 정답과 해설을 확인해 보세요.")
  );
  practice.append(practiceText, link(routeFor(unit, "quiz"), "연습문제", "button button-primary"));
  lesson.append(...topics.map(topic => topic.container), practice);
  layout.append(sidebar, lesson);
  page.append(pageHeading(unit, "lesson"), layout);
  setPage(page, unit.theme, unit.title);
  currentLesson = { id: unit.id, topics };
  moveToTopic(topics, topicId);
}

// Read eight CSV columns, including quoted cells, Excel's UTF-8 BOM, and CRLF.
function readCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const value = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n") + "\n";
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '"' && quoted && value[i + 1] === '"') {
      field += '"';
      i++;
    } else if (char === '"' && (quoted || !field)) {
      quoted = !quoted;
    } else if (!quoted && (char === "," || char === "\n")) {
      row.push(field.trim());
      field = "";
      if (char === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else {
      field += char;
    }
  }
  if (quoted || rows[0]?.join(",") !== "유형,문제,보기1,보기2,보기3,보기4,정답,해설") {
    throw new Error("문제 파일 형식 오류");
  }
  return rows.slice(1);
}

function readQuestions(csv) {
  const rows = readCsv(csv);
  if (!rows.length) throw new Error("문항 없음");
  return rows.map(([type, text, first, second, third, fourth, key, explanation], index) => {
    const choices = type === "OX" ? [first, second] : [first, second, third, fourth];
    const answer = Number(key) - 1;
    if (rows[index].length !== 8 || !["객관식", "OX"].includes(type) || !text || !explanation
      || choices.some(choice => !choice) || !Number.isInteger(answer) || !choices[answer]) {
      throw new Error((index + 1) + "번 문항 형식 오류");
    }
    return { type, text, choices, answer, explanation };
  });
}

function questionField(question, index) {
  const card = element("fieldset", "question-card");
  const legend = element("legend", "visually-hidden", (index + 1) + ". " + question.text);
  const title = element("div", "question-legend");
  title.setAttribute("aria-hidden", "true");
  title.append(
    element("span", "question-number", String(index + 1)),
    element("span", "", question.text)
  );
  const options = element("div", question.type === "OX" ? "options options-ox" : "options");
  const inputs = question.choices.map((choice, optionIndex) => {
    const label = element("label", "option");
    const input = element("input");
    input.type = "radio";
    input.name = "question-" + index;
    input.value = String(optionIndex);
    label.append(input, element("span", "choice-text", choice));
    options.append(label);
    return input;
  });
  card.append(legend, title, options);
  return { card, inputs };
}

function showQuiz(unit, questions) {
  const page = element("div", "wrap interior quiz-page");
  const form = element("form", "quiz");
  const result = element("section", "quiz-result");
  result.tabIndex = -1;
  result.hidden = true;

  const status = element("p", "quiz-progress");
  status.setAttribute("role", "status");
  const progress = element("progress");
  progress.max = questions.length;
  progress.value = 0;
  progress.setAttribute("aria-label", "답한 문항 수");

  const fields = questions.map(questionField);
  const feedback = element("p", "quiz-message");
  feedback.setAttribute("role", "alert");
  const actions = element("div", "quiz-actions");
  const submit = element("button", "button button-primary", "채점하기");
  submit.type = "submit";
  actions.append(submit);
  form.append(status, progress, result, ...fields.map(field => field.card), feedback, actions);
  page.append(pageHeading(unit, "quiz"), form);
  setPage(page, unit.theme, "연습문제");
  focusPage();

  function updateProgress() {
    const answered = fields.filter(field => field.inputs.some(input => input.checked)).length;
    status.textContent = questions.length + "문항 중 " + answered + "문항에 답했어요.";
    progress.value = answered;
  }

  updateProgress();
  form.addEventListener("change", () => {
    feedback.textContent = "";
    updateProgress();
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (submit.disabled) return;
    const answers = fields.map(field => field.inputs.findIndex(input => input.checked));
    const unanswered = answers.indexOf(-1);
    if (unanswered !== -1) {
      feedback.textContent = (unanswered + 1) + "번 문항부터 아직 답하지 않은 문제를 풀어 주세요.";
      fields[unanswered].inputs[0].focus();
      return;
    }

    let score = 0;
    questions.forEach((question, index) => {
      const picked = answers[index];
      const { card, inputs } = fields[index];
      const correct = picked === question.answer;
      if (correct) score++;
      inputs.forEach((input, choice) => {
        input.disabled = true;
        const label = input.parentElement;
        if (choice === question.answer) label.classList.add("option-correct");
        else if (choice === picked) label.classList.add("option-incorrect");
      });
      const explanation = element("div", "explanation");
      explanation.append(
        element("strong", "", (correct ? "정답이에요. " : "다시 살펴봐요. ") + "정답 · " + question.choices[question.answer]),
        element("p", "", question.explanation)
      );
      card.append(explanation);
    });

    submit.disabled = true;
    result.hidden = false;
    result.append(
      element("h2", "", score + " / " + questions.length + "문항 정답"),
      element("p", "", "아래에서 문항별 정답과 해설을 확인할 수 있어요.")
    );
    const retry = element("button", "button button-primary", "다시 풀기");
    retry.type = "button";
    retry.addEventListener("click", () => showQuiz(unit, questions));
    actions.replaceChildren(retry, link(routeFor(unit), "핵심 개념 다시 보기", "button button-secondary"));
    result.focus();
  });
}

async function navigate() {
  const [id, view] = location.hash.slice(1).split("/");
  const unit = units.find(item => item.id === id);
  const sequence = ++navigation;

  for (const navLink of document.querySelectorAll(".main-nav a")) {
    const active = unit && navLink.hash === routeFor(unit);
    if (active) navLink.setAttribute("aria-current", "page");
    else navLink.removeAttribute("aria-current");
  }

  if (!unit) {
    currentLesson = null;
    showHome();
    focusPage();
    return;
  }
  if (view !== "quiz" && currentLesson?.id === id) {
    moveToTopic(currentLesson.topics, view);
    return;
  }
  currentLesson = null;
  const loading = element("div", "wrap interim", "학습 자료를 불러오는 중이에요.");
  loading.setAttribute("role", "status");
  setPage(loading, unit.theme, unit.title);

  try {
    if (view === "quiz") {
      const csv = await loadText("content/quiz-" + id + ".csv");
      if (sequence === navigation) showQuiz(unit, readQuestions(csv));
    } else {
      const markdown = await loadText("content/unit-" + id + ".md");
      if (sequence === navigation) showLesson(unit, markdown, view);
    }
  } catch (error) {
    if (sequence !== navigation) return;
    console.error(error);
    const message = element("div", "wrap interim");
    message.append(
      element("h1", "", "학습 자료를 열 수 없어요"),
      element("p", "", "잠시 후 다시 시도하거나 단원 목록에서 돌아와 주세요."),
      link("#", "전체 단원", "button button-primary")
    );
    setPage(message, unit.theme, unit.title);
    focusPage();
  }
}

dialog.querySelector("button").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});
document.querySelector(".skip-link").addEventListener("click", event => {
  event.preventDefault();
  main.focus();
});
window.addEventListener("hashchange", navigate);
navigate();
