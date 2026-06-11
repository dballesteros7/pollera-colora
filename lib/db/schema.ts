import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const otpCodes = sqliteTable("otp_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumed: integer("consumed", { mode: "boolean" }).notNull().default(false),
});

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  organizerId: text("organizer_id")
    .notNull()
    .references(() => users.id),
  // JSON: { preset: "clasica" | "marcador_o_nada" | "escalonada", unicoAcertado: boolean, overrides?: {...} }
  scoringRules: text("scoring_rules", { mode: "json" }).notNull(),
  bonusLockAt: integer("bonus_lock_at", { mode: "timestamp_ms" }),
  potNote: text("pot_note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const memberships = sqliteTable(
  "memberships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id),
    role: text("role", { enum: ["organizer", "member"] })
      .notNull()
      .default("member"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
);

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fdId: integer("fd_id").notNull().unique(),
  stage: text("stage").notNull(),
  matchday: integer("matchday"),
  kickoffUtc: integer("kickoff_utc", { mode: "timestamp_ms" }).notNull(),
  // null while a knockout slot is still TBD
  homeTeam: text("home_team"),
  awayTeam: text("away_team"),
  homeCrest: text("home_crest"),
  awayCrest: text("away_crest"),
  status: text("status").notNull(), // SCHEDULED|TIMED|IN_PLAY|PAUSED|FINISHED|...
  duration: text("duration"), // REGULAR|EXTRA_TIME|PENALTY_SHOOTOUT
  // regulation-time score — what predictions are scored against
  regHome: integer("reg_home"),
  regAway: integer("reg_away"),
  // full final score as played (incl. extra time), for display
  finalHome: integer("final_home"),
  finalAway: integer("final_away"),
  manualOverride: integer("manual_override", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const predictions = sqliteTable(
  "predictions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    predHome: integer("pred_home").notNull(),
    predAway: integer("pred_away").notNull(),
    joker: integer("joker", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("predictions_user_group_match").on(
      t.userId,
      t.groupId,
      t.matchId,
    ),
  ],
);

export const bonusPicks = sqliteTable(
  "bonus_picks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id),
    category: text("category", {
      enum: ["champion", "runner_up", "third", "top_scorer", "best_gk"],
    }).notNull(),
    value: text("value").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("bonus_picks_user_group_category").on(
      t.userId,
      t.groupId,
      t.category,
    ),
  ],
);

export const propQuestions = sqliteTable("prop_questions", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id),
  proposerId: text("proposer_id")
    .notNull()
    .references(() => users.id),
  status: text("status", {
    enum: ["proposed", "approved", "rejected", "resolved"],
  })
    .notNull()
    .default("proposed"),
  question: text("question").notNull(),
  answerType: text("answer_type", {
    enum: ["number", "boolean", "choice"],
  }).notNull(),
  options: text("options", { mode: "json" }), // string[] for "choice"
  points: integer("points").notNull(),
  matchId: integer("match_id").references(() => matches.id),
  lockAt: integer("lock_at", { mode: "timestamp_ms" }).notNull(),
  resolutionMode: text("resolution_mode", { enum: ["exact", "closest"] }),
  correctValue: text("correct_value"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const propAnswers = sqliteTable(
  "prop_answers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    questionId: text("question_id")
      .notNull()
      .references(() => propQuestions.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    value: text("value").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("prop_answers_question_user").on(t.questionId, t.userId)],
);

// cache, rebuilt whenever results change
export const scores = sqliteTable(
  "scores",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id),
    pointsMatches: integer("points_matches").notNull().default(0),
    pointsBonus: integer("points_bonus").notNull().default(0),
    pointsProps: integer("points_props").notNull().default(0),
    exactCount: integer("exact_count").notNull().default(0),
    resultCount: integer("result_count").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
);
