import { generateKey, hashKey } from "../server/credentials.js";

const key = generateKey();
console.log("교사용 비밀번호 (답변 등록 시 입력)\n" + key);
console.log("\nVercel 환경 변수 QUESTION_TEACHER_KEY_HASH에 넣을 값\n" + hashKey(key));
