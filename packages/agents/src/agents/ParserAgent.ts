import { BaseAgent } from "../BaseAgent";
import { createLLMRouter } from "@jobblitz/core";
import type { LLMResponse } from "@jobblitz/core";

export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: Array<{ title: string; company: string; duration: string }>;
  education: Array<{ degree: string; institution: string; year: string }>;
  summary: string;
  parsingConfidence: number;
}

const COMMON_SKILLS = [
  "javascript", "typescript", "python", "java", "go", "rust", "c++", "c#",
  "react", "vue", "angular", "svelte", "next.js", "node.js", "express",
  "django", "flask", "fastapi", "spring", "rails",
  "sql", "postgresql", "mysql", "mongodb", "redis", "dynamodb",
  "aws", "gcp", "azure", "docker", "kubernetes", "terraform",
  "git", "github", "gitlab", "ci/cd", "jenkins", "github actions",
  "machine learning", "data science", "pandas", "numpy", "tensorflow", "pytorch",
  "product management", "agile", "scrum", "jira",
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /\+?\d[\d\s-]{7,}\d/;

const SYSTEM_PROMPT = `You are a resume parser. Extract structured data from the resume text provided by the user. Return ONLY a JSON object with this exact shape:
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "skills": ["string"],
  "experience": [{"title": "string", "company": "string", "duration": "string"}],
  "education": [{"degree": "string", "institution": "string", "year": "string"}],
  "summary": "string"
}
Do not include markdown or explanations.`;

function parseWithRegex(text: string): ParsedResume {
  const lower = text.toLowerCase();
  const foundSkills = COMMON_SKILLS.filter((s) => lower.includes(s));
  const email = text.match(EMAIL_RE)?.[0] ?? "";
  const phone = text.match(PHONE_RE)?.[0] ?? "";
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let name = "";
  for (const line of lines.slice(0, 5)) {
    if (line.includes("@") || line.match(/\d{3}/)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.every((w) => /^[A-Z][a-z]+$/.test(w))) {
      name = line;
      break;
    }
  }
  const confidence = Math.min(95, 40 + foundSkills.length * 5 + (email ? 15 : 0) + (phone ? 10 : 0));
  return {
    name, email, phone,
    skills: [...new Set(foundSkills)],
    experience: [], education: [],
    summary: lines.slice(0, 3).join(" "),
    parsingConfidence: confidence,
  };
}

function parseLLMResponse(res: LLMResponse): ParsedResume {
  try {
    const raw = res.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      name: String(data.name ?? ""),
      email: String(data.email ?? ""),
      phone: String(data.phone ?? ""),
      skills: Array.isArray(data.skills) ? data.skills.map(String) : [],
      experience: Array.isArray(data.experience)
        ? data.experience.map((e: unknown) => ({
            title: String((e as Record<string, unknown>).title ?? ""),
            company: String((e as Record<string, unknown>).company ?? ""),
            duration: String((e as Record<string, unknown>).duration ?? ""),
          }))
        : [],
      education: Array.isArray(data.education)
        ? data.education.map((e: unknown) => ({
            degree: String((e as Record<string, unknown>).degree ?? ""),
            institution: String((e as Record<string, unknown>).institution ?? ""),
            year: String((e as Record<string, unknown>).year ?? ""),
          }))
        : [],
      summary: String(data.summary ?? ""),
      parsingConfidence: 90,
    };
  } catch {
    return parseWithRegex(res.text);
  }
}

export class ParserAgent extends BaseAgent<string, ParsedResume> {
  readonly name = "ParserAgent";
  readonly model = "openai-gpt-4o-mini";

  protected async run(text: string): Promise<ParsedResume> {
    const regexResult = parseWithRegex(text);
    if (regexResult.parsingConfidence >= 80) {
      return regexResult;
    }

    try {
      const router = createLLMRouter();
      const res = await router.generate(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text.slice(0, 12000) },
        ],
        { jsonMode: true, maxTokens: 2048, temperature: 0.2 }
      );
      const parsed = parseLLMResponse(res);
      if (parsed.name || parsed.skills.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.error("[ParserAgent] LLM parse failed, using regex fallback:", err instanceof Error ? err.message : String(err));
    }

    return regexResult;
  }

  protected fallbackResult(_text: string): ParsedResume {
    return { name: "", email: "", phone: "", skills: [], experience: [], education: [], summary: "", parsingConfidence: 0 };
  }
}

export const parserAgent = new ParserAgent();
