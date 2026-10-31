import { z } from 'zod';
import { CLASS_IDS, QUESTION_TYPES } from '@shared/types/index.js';

const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

export const classIdSchema = z.string().refine((v) => CLASS_IDS.includes(v), '존재하지 않는 학급입니다.');

export const loginSchema = z.object({ username: text(50), password: z.string().min(1).max(200) });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.').max(200),
});

export const questionSchema = z
  .object({
    questionType: z.enum(QUESTION_TYPES).default('MULTIPLE_CHOICE'),
    questionText: text(500),
    options: z.array(text(120)).min(2).max(4),
    correctIndex: z.number().int().min(0).max(3),
    timeLimit: z.number().int().min(5).max(300).default(20),
    isDoublePoints: z.boolean().default(false),
    orderNum: z.number().int().min(0).max(100000).default(0),
    explanation: optText(1000),
    category: optText(50),
  })
  .refine((q) => q.correctIndex < q.options.length, { message: '정답 번호가 보기 개수를 벗어났습니다.', path: ['correctIndex'] })
  .refine((q) => q.questionType !== 'MULTIPLE_CHOICE' || q.options.length === 4, { message: '4지선다형은 보기 4개가 필요합니다.', path: ['options'] })
  .refine((q) => q.questionType !== 'SHORT_ANSWER', { message: '단답형은 아직 지원하지 않습니다.', path: ['questionType'] });

export const quizSetSchema = z.object({
  title: text(100),
  description: optText(500),
  category: optText(50),
  questionIds: z.array(z.number().int().positive()).max(200).default([]),
});

// 닉네임: 한글/영문/숫자/공백/일부 기호만 허용 (HTML 특수문자 차단)
export const nicknameSchema = z
  .string()
  .transform((s) => s.normalize('NFC').replace(/\s+/g, ' ').trim())
  .pipe(
    z
      .string()
      .min(1, '닉네임을 입력하세요.')
      .max(12, '닉네임은 12자 이하로 입력하세요.')
      .regex(/^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ _.\-]+$/, '닉네임에는 한글, 영문, 숫자, 공백, _ . - 만 사용할 수 있습니다.'),
  );
export const joinSchema = z.object({ nickname: nicknameSchema });

export const createSessionSchema = z.object({
  competitionId: z.number().int().positive(),
  quizSetId: z.number().int().positive(),
});

export const competitionSchema = z.object({
  title: text(100),
  description: optText(500),
  quizSetId: z.number().int().positive().optional(),
  classIds: z.array(classIdSchema).max(12).default([]),
});
export const competitionUpdateSchema = z.object({ title: text(100), description: optText(500) });

export const leaderboardQuery = z.object({
  classId: classIdSchema.optional(),
  competitionId: z.coerce.number().int().positive().optional(),
  scope: z.enum(['class', 'school', 'classes']).default('class'),
});

export const resetSchema = z.object({
  scope: z.enum(['class', 'all']),
  classId: classIdSchema.optional(),
  confirm: z.literal('RESET', { message: '확인 문구 RESET 을 정확히 입력해야 합니다.' }),
  removeParticipants: z.boolean().default(false),
});

export const logQuery = z.object({
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
  classId: classIdSchema.optional(),
  eventType: z.string().max(50).optional(),
  participantId: z.coerce.number().int().positive().optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

export const settingsSchema = z.object({
  projectorNameMode: z.enum(['FULL', 'MASKED', 'HIDDEN']).optional(),
  leaderboardSize: z.number().int().min(3).max(35).optional(),
});
