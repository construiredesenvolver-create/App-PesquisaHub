import { Survey, Question, Option, Respondent, Answer } from '../types';

export const INITIAL_SURVEYS: Survey[] = [];
export const INITIAL_QUESTIONS: Question[] = [];
export const INITIAL_OPTIONS: Option[] = [];

export function generateInitialResponses(): { respondents: Respondent[]; answers: Answer[] } {
  return { respondents: [], answers: [] };
}
