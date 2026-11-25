import { handleQuestions } from "../server/questions.js";

export default { fetch: request => handleQuestions(request) };
