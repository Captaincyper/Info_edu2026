CREATE TABLE IF NOT EXISTS course_questions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author text NOT NULL CHECK (char_length(author) BETWEEN 1 AND 30),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  password_hash text NOT NULL,
  manage_key_hash text NOT NULL,
  failed_attempts smallint NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  reply text CHECK (char_length(reply) BETWEEN 1 AND 2000),
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((reply IS NULL) = (replied_at IS NULL))
);
