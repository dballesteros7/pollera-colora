import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  // the Claude bot player ("Claudio di María") — drives the UI bot badge
  isBot: integer("is_bot", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  // touched at most hourly on authenticated requests — feeds DAU/WAU metrics
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
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
}, (t) => [index("otp_codes_email").on(t.email)]);

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  organizerId: text("organizer_id")
    .notNull()
    .references(() => users.id),
  // JSON: { preset: "clasica" | "marcador_o_nada" | "escalonada", unicoAcertado: boolean, overrides?: {...} }
  scoringRules: text("scoring_rules", { mode: "json" }).notNull(),
  // the singleton "Súper Polla": every active player auto-competes here, scored
  // by reusing their home-polla knockout picks. No pick entry of its own.
  isSuper: integer("is_super", { mode: "boolean" }).notNull().default(false),
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
  (t) => [
    primaryKey({ columns: [t.userId, t.groupId] }),
    // member lists, leaderboards, quorum counts query by group
    index("memberships_group").on(t.groupId),
  ],
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
    // group-wide reads (fixtures pick lists, score rebuilds)
    index("predictions_group_match").on(t.groupId, t.matchId),
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
    index("bonus_picks_group").on(t.groupId),
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
  // member count frozen at proposal time — the approval quorum base
  eligibleCount: integer("eligible_count"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [index("prop_questions_group").on(t.groupId)]);

export const propVotes = sqliteTable(
  "prop_votes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    questionId: text("question_id")
      .notNull()
      .references(() => propQuestions.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    vote: text("vote", { enum: ["approve", "reject"] }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("prop_votes_question_user").on(t.questionId, t.userId)],
);

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

// real tournament outcomes, entered by the app admin as they become known
export const tournamentOutcomes = sqliteTable("tournament_outcomes", {
  category: text("category", {
    enum: ["champion", "runner_up", "third", "top_scorer", "best_gk"],
  }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// each player's chosen identity in the Súper Polla, set on first open. A row's
// existence means they've decided; until then they're anonymized to strangers
// by the usual famous-alias strategy. mode "real" reveals their display name to
// everyone; "nickname" shows the chosen handle instead.
export const superIdentities = sqliteTable("super_identities", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  mode: text("mode", { enum: ["real", "nickname"] }).notNull(),
  nickname: text("nickname"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

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
