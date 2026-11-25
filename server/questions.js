import pg from "pg";
import { generateKey, hashKey, hashPassword, matchesKey, matchesPassword } from "./credentials.js";

const publicColumns = "id::text AS id, author, body, reply, created_at, replied_at, failed_attempts = 5 AS locked";
const editable = "reply IS NULL AND failed_attempts < 5";
const pageSize = 25;
let pool;

function query(sql, parameters) {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000
    });
    pool.on("error", error => console.error("Idle question database connection closed", error.code ?? error.name));
  }
  return pool.query(sql, parameters);
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function problem(message, status) {
  return json({ message }, status);
}

function validId(id) {
  return typeof id === "string" && /^[1-9][0-9]{0,17}$/.test(id);
}

function cleanText(value, max) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length <= max && !trimmed.includes("\0") ? trimmed : "";
}

async function readInput(request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return null;
  try {
    const text = await request.text();
    if (text.length > 16000) return null;
    const input = JSON.parse(text);
    return input && typeof input === "object" && !Array.isArray(input) ? input : null;
  } catch {
    return null;
  }
}

async function readQuestions(url) {
  const id = url.searchParams.get("id");
  if (id !== null) {
    if (!validId(id)) return problem("질문 번호를 확인해 주세요.", 400);
    const { rows } = await query(
      "SELECT " + publicColumns + " FROM course_questions WHERE id = $1",
      [id]
    );
    return rows[0] ? json(rows[0]) : problem("질문을 찾을 수 없어요.", 404);
  }

  const before = url.searchParams.get("before");
  if (before !== null && !validId(before)) return problem("목록 위치를 확인해 주세요.", 400);
  const { rows } = await query(
    "SELECT " + publicColumns + " FROM course_questions" +
      (before === null ? "" : " WHERE id < $1") +
      " ORDER BY course_questions.id DESC LIMIT " + (pageSize + 1),
    before === null ? [] : [before]
  );
  return json({
    questions: rows.slice(0, pageSize),
    next: rows.length > pageSize ? rows[pageSize - 1].id : null
  });
}

async function createQuestion(input) {
  const author = cleanText(input.author, 30);
  const body = cleanText(input.body, 2000);
  const password = input.password;
  if (!author || !body || typeof password !== "string" || password.length < 4 || password.length > 128 || !password.trim()) {
    return problem("질문자명, 질문 내용, 글 비밀번호(4~128자)를 확인해 주세요.", 400);
  }
  const manageKey = generateKey();
  const { rows } = await query(
    "INSERT INTO course_questions (author, body, password_hash, manage_key_hash) VALUES ($1, $2, $3, $4) RETURNING id::text AS id",
    [author, body, await hashPassword(password), hashKey(manageKey)]
  );
  return json({ id: rows[0].id, manageKey }, 201);
}

async function changeQuestion(input, method) {
  const { id, manageKey, password } = input;
  const body = method === "PATCH" ? cleanText(input.body, 2000) : null;
  if (!validId(id) || typeof manageKey !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(manageKey)) {
    return problem("질문을 올릴 때 받은 관리 링크를 확인해 주세요.", 404);
  }
  if (typeof password !== "string" || !password || password.length > 128 || (method === "PATCH" && !body)) {
    return problem("질문 내용과 글 비밀번호를 확인해 주세요.", 400);
  }
  const { rows: [question] } = await query(
    "SELECT manage_key_hash, password_hash, reply, failed_attempts FROM course_questions WHERE id = $1",
    [id]
  );
  if (!question || !matchesKey(manageKey, question.manage_key_hash)) {
    return problem("질문을 올릴 때 받은 관리 링크를 확인해 주세요.", 404);
  }

  const blocked = () => problem("답변이 등록되었거나 비밀번호가 5회 틀려 수정·삭제가 잠겼어요.", 409);
  if (question.reply !== null || question.failed_attempts >= 5) return blocked();

  // Each write rechecks the lock conditions so a concurrent reply or fifth failure takes effect immediately.
  if (!(await matchesPassword(password, question.password_hash))) {
    const { rows: [attempt] } = await query(
      "UPDATE course_questions SET failed_attempts = failed_attempts + 1 WHERE id = $1 AND " +
        editable + " RETURNING failed_attempts",
      [id]
    );
    if (!attempt || attempt.failed_attempts === 5) return blocked();
    return problem("비밀번호가 틀렸어요. 남은 시도 횟수는 " + (5 - attempt.failed_attempts) + "회예요.", 403);
  }

  const result = method === "PATCH"
    ? await query("UPDATE course_questions SET body = $2 WHERE id = $1 AND " + editable, [id, body])
    : await query("DELETE FROM course_questions WHERE id = $1 AND " + editable, [id]);
  return result.rowCount ? json({ ok: true }) : blocked();
}

async function postReply(input) {
  const teacherHash = process.env.QUESTION_TEACHER_KEY_HASH;
  if (!teacherHash || !/^[a-f0-9]{64}$/.test(teacherHash)) {
    return problem("교사용 답변 기능을 준비 중이에요.", 503);
  }
  const { id, teacherKey } = input;
  const reply = cleanText(input.reply, 2000);
  if (!validId(id) || !reply || typeof teacherKey !== "string" || teacherKey.length > 128 || !teacherKey) {
    return problem("답변 내용과 교사용 비밀번호를 확인해 주세요.", 400);
  }
  if (!matchesKey(teacherKey, teacherHash)) return problem("교사용 비밀번호가 틀렸어요.", 403);

  const result = await query(
    "UPDATE course_questions SET reply = $2, replied_at = now() WHERE id = $1 AND reply IS NULL",
    [id, reply]
  );
  return result.rowCount ? json({ ok: true }) : problem("이미 답변이 달렸거나 삭제된 질문이에요.", 409);
}

export async function handleQuestions(request, replyOnly = false) {
  try {
    const methods = replyOnly ? ["POST"] : ["GET", "POST", "PATCH", "DELETE"];
    if (!methods.includes(request.method)) {
      return new Response(null, { status: 405, headers: { Allow: methods.join(", ") } });
    }
    if (!process.env.DATABASE_URL) return problem("질문함을 준비 중이에요.", 503);
    if (request.method === "GET") return await readQuestions(new URL(request.url));
    const input = await readInput(request);
    if (!input) return problem("입력 내용을 확인해 주세요.", 400);
    if (replyOnly) return await postReply(input);
    if (request.method === "POST") return await createQuestion(input);
    return await changeQuestion(input, request.method);
  } catch (error) {
    console.error("Question board request failed", error.code ?? error.name);
    return problem("질문함에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.", 503);
  }
}
