async function questionRequest(path = "/api/questions", method = "GET", data) {
  const options = { method };
  if (data !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(data);
  }

  let response;
  let payload;
  try {
    response = await fetch(path, options);
    payload = await response.json();
  } catch {
    throw new Error("질문함에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!response.ok) {
    const error = new Error(payload.message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function questionStatus() {
  const status = element("p", "question-status");
  status.setAttribute("role", "status");
  return status;
}

function questionFieldLabel(label, name, type, maxLength, value = "") {
  const wrapper = element("label", "question-label", label);
  const input = element(type === "textarea" ? "textarea" : "input");
  input.name = name;
  input.required = true;
  input.maxLength = maxLength;
  input.value = value;
  if (type === "textarea") input.rows = 4;
  else input.type = type;
  if (type === "password") input.autocomplete = "off";
  wrapper.append(input);
  return wrapper;
}

function submitQuestion(form, status, submit) {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const buttons = [...form.querySelectorAll('button[type="submit"]')];
    if (buttons.some(button => button.disabled)) return;
    buttons.forEach(button => { button.disabled = true; });
    status.textContent = "";
    try {
      await submit(Object.fromEntries(new FormData(form)), event.submitter?.value);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  });
}

function questionSubmitButton(label, style = "primary") {
  const button = element("button", "button button-" + style, label);
  button.type = "submit";
  return button;
}

function questionRegistration(reload) {
  const card = element("section", "question-card");
  const form = element("form", "question-form");
  const nameField = questionFieldLabel("질문자명", "author", "text", 30);
  nameField.querySelector("input").placeholder = "다른 사람에게 보여도 괜찮은 이름";
  const passwordField = questionFieldLabel("글 비밀번호 (4~128자)", "password", "password", 128);
  passwordField.querySelector("input").minLength = 4;
  passwordField.querySelector("input").autocomplete = "new-password";
  const status = questionStatus();
  const manageNotice = element("div", "question-manage-notice");
  manageNotice.hidden = true;
  form.append(
    nameField,
    questionFieldLabel("질문 내용", "body", "textarea", 2000),
    passwordField,
    questionSubmitButton("질문 올리기"),
    status
  );

  submitQuestion(form, status, async data => {
    const { id, manageKey } = await questionRequest("/api/questions", "POST", data);
    form.reset();
    const manageUrl = new URL(location.href);
    manageUrl.hash = "questions/manage/" + id + "/" + manageKey;
    const manageLink = link(manageUrl.href, "내 질문 관리 열기");
    const copy = element("button", "button button-secondary", "관리 링크 복사");
    copy.type = "button";
    const label = questionFieldLabel("내 질문 관리 링크", "manage-url", "url", 2048, manageUrl.href);
    const urlInput = label.querySelector("input");
    urlInput.readOnly = true;
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(manageUrl.href);
        status.textContent = "관리 링크를 복사했어요.";
      } catch {
        urlInput.focus();
        urlInput.select();
        status.textContent = "선택한 링크를 복사해 보관해 주세요.";
      }
    });
    status.textContent = "질문을 등록했어요.";
    manageNotice.replaceChildren(
      element("p", "", "아래 링크를 보관해 주세요. 이 링크에서 글 비밀번호를 입력하면 답변이 달리기 전에 수정하거나 삭제할 수 있어요."),
      label,
      manageLink,
      copy
    );
    manageNotice.hidden = false;
    await reload();
  });

  card.append(
    element("h2", "", "질문 올리기"),
    element("p", "", "질문과 질문자명은 질문함에 공개돼요. 연락처처럼 개인을 알아볼 수 있는 정보는 빼고 써 주세요."),
    form,
    manageNotice
  );
  return card;
}

const questionDate = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "medium",
  timeStyle: "short"
});

function questionCard(question) {
  const card = element("article", "question-card");
  card.append(
    element("h3", "", question.author + "의 질문"),
    element("p", "question-meta", questionDate.format(new Date(question.created_at)) + " · " +
      (question.reply !== null ? "답변 완료" : "답변 대기")),
    element("p", "question-text", question.body)
  );
  if (question.reply !== null) {
    const answer = element("div", "question-answer");
    answer.append(
      element("h4", "", "선생님 답변"),
      element("p", "question-text", question.reply)
    );
    card.append(answer);
  }
  return card;
}

function questionReply(questionId, reload) {
  const details = element("details", "question-teacher");
  const form = element("form", "question-form");
  const status = questionStatus();
  form.append(
    questionFieldLabel("답변 내용", "reply", "textarea", 2000),
    questionFieldLabel("교사용 비밀번호", "teacherKey", "password", 128),
    questionSubmitButton("답변 등록", "secondary"),
    status
  );
  submitQuestion(form, status, async data => {
    await questionRequest("/api/reply", "POST", { id: questionId, ...data });
    form.reset();
    await reload();
  });
  details.append(element("summary", "", "선생님 답변 작성"), form);
  return details;
}

function questionList() {
  const section = element("section", "question-list");
  const status = questionStatus();
  const cards = element("div", "question-cards");
  const more = element("button", "button button-secondary", "이전 질문 더 보기");
  more.type = "button";
  more.hidden = true;
  let sequence = 0;
  let next = null;

  async function load(before = null) {
    const current = ++sequence;
    status.textContent = "질문을 불러오는 중이에요.";
    more.hidden = true;
    try {
      const data = await questionRequest("/api/questions" + (before === null ? "" : "?before=" + encodeURIComponent(before)));
      if (current !== sequence) return;
      if (before === null) cards.replaceChildren();
      for (const question of data.questions) {
        const card = questionCard(question);
        if (question.reply === null) card.append(questionReply(question.id, load));
        cards.append(card);
      }
      status.textContent = cards.childElementCount ? "" : "아직 올라온 질문이 없어요.";
      next = data.next;
      more.hidden = next === null;
    } catch (error) {
      if (current !== sequence) return;
      status.textContent = error.message;
      more.hidden = before === null;
    }
  }

  more.addEventListener("click", () => load(next));
  section.append(element("h2", "", "올라온 질문"), status, cards, more);
  return { section, load };
}

async function manageQuestion(page, id, manageKey) {
  page.append(link("#questions", "질문 목록으로"));
  const panel = element("section", "question-card");
  const status = questionStatus();
  status.textContent = "질문을 불러오는 중이에요.";
  page.append(panel, status);
  if (!/^[1-9][0-9]{0,17}$/.test(id ?? "") || !/^[A-Za-z0-9_-]{43}$/.test(manageKey ?? "")) {
    status.textContent = "질문을 올릴 때 받은 관리 링크를 확인해 주세요.";
    return;
  }

  try {
    const question = await questionRequest("/api/questions?id=" + id);
    panel.replaceWith(questionCard(question));
    if (question.reply !== null || question.locked) {
      status.textContent = "답변이 등록되었거나 비밀번호가 5회 틀려 수정·삭제가 잠겼어요.";
      return;
    }
    status.textContent = "";
    const form = element("form", "question-form question-card");
    const edit = questionSubmitButton("수정 저장");
    const remove = questionSubmitButton("질문 삭제", "secondary");
    remove.value = "delete";
    const actions = element("div", "question-actions");
    actions.append(edit, remove);
    form.append(
      questionFieldLabel("질문 내용", "body", "textarea", 2000, question.body),
      questionFieldLabel("글 비밀번호", "password", "password", 128),
      actions,
      status
    );
    page.append(form);

    submitQuestion(form, status, async (data, action) => {
      const deleting = action === "delete";
      if (deleting && !window.confirm("이 질문을 삭제할까요?")) return;
      const password = form.elements.password;
      try {
        await questionRequest("/api/questions", deleting ? "DELETE" : "PATCH", { id, manageKey, ...data });
        if (deleting) {
          if (page.isConnected) location.hash = "questions";
        } else {
          page.querySelector("article .question-text").textContent = data.body.trim();
          status.textContent = "질문을 수정했어요.";
        }
      } catch (error) {
        if (error.status === 409) form.replaceChildren(status);
        throw error;
      } finally {
        password.value = "";
      }
    });
  } catch (error) {
    panel.remove();
    status.textContent = error.message;
  }
}

function showQuestions(view, id, manageKey) {
  const page = element("div", "wrap question-board");
  const managing = view === "manage";
  const title = managing ? "내 질문 관리" : "질문함";
  page.append(element("h1", "", title));
  setPage(page, "", title);

  if (managing) {
    void manageQuestion(page, id, manageKey);
    return;
  }
  const list = questionList();
  page.append(questionRegistration(list.load), list.section);
  void list.load();
}
