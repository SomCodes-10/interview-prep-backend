const path = require('path');
const os = require('os');

// MUST be set before requiring puppeteer — Puppeteer reads its config at require() time.
// Uses os.homedir() so it resolves to a writable path on any server (e.g. /root/.cache/puppeteer on Render).
process.env.PUPPETEER_CACHE_DIR = path.join(os.homedir(), '.cache', 'puppeteer');

const { GoogleGenAI, Behavior } = require("@google/genai")
const { z } = require("zod")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GEN_AI_API_KEY
})

const interviewReportSchema = z.object({
  matchScore: z.number().describe("Overall percentage indicating how well the candidate matches the job requirements. Use a score between 0 and 100."),
  technicalQuestions: z.array(z.object({
    question: z.string().describe("The technical question can be asked in the interview"),
    intention: z.string().describe("The intention of the interviewer behind askiing this question"),
    answer: z.string().describe("How to answer this question,what points to cover, what approac to take etc")
  })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
  behavioralQuestions: z.array(z.object({
    question: z.string().describe("The technical question can be asked in the interview"),
    intention: z.string().describe("The intention of the interviewer behind askiing this question"),
    answer: z.string().describe("How to answer this question,what points to cover, what approac to take etc")
  })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
  skillGap: z.array(z.object({
    skill: z.string().describe("The skill which the candidate is lacking"),
    severity: z.enum(["low", "medium", "high"]).describe("The severity of that particular skill according to the job targetted")
  })).describe("List of skill gaps in the candidate's profile along with their severity"),
  preparationPlan: z.array(z.object({
    day: z.number().describe("The day number in the preparation plan,start day and end day"),
    focus: z.string().describe("Main topic or area to focus on for the day."),
    tasks: z.array(z.string().describe("A specific task to complete on that day."))
  })).describe("A day-wise interview preparation plan."),
  title: z.string().describe("The title of the job for whih the interview report is pgenerated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {

  const prompt = `You are an expert technical interviewer and career coach.

Analyze the following candidate profile and job description, then generate a comprehensive interview preparation report.

Candidate Resume:
${resume}

Candidate Self Description:
${selfDescription}

Job Description:
${jobDescription}

Generate a detailed report including:
- Overall match score (0-100)
- Technical interview questions with intentions and answers
- Behavioral interview questions with intentions and answers
- Skill gaps with severity
- A day-wise preparation plan
- IMPORTANT: Use exactly these field names in your JSON response: matchScore, technicalQuestions, behavioralQuestions, skillGap, preparationPlan, focus, tasks.  Do not use snake_case field names.`



  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          matchScore: { type: "number" },
          technicalQuestions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, intention: { type: "string" }, answer: { type: "string" } }, required: ["question", "intention", "answer"] } },
          behavioralQuestions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, intention: { type: "string" }, answer: { type: "string" } }, required: ["question", "intention", "answer"] } },
          skillGap: { type: "array", items: { type: "object", properties: { skill: { type: "string" }, severity: { type: "string", enum: ["low", "medium", "high"] } }, required: ["skill", "severity"] } },
          preparationPlan: { type: "array", items: { type: "object", properties: { day: { type: "number" }, focus: { type: "string" }, tasks: { type: "array", items: { type: "string" } } }, required: ["day", "focus", "tasks"] } }
        },
        required: ["matchScore", "technicalQuestions", "behavioralQuestions", "skillGap", "preparationPlan"]
      }
    }
  });

  return JSON.parse(response.text)
}

async function generatePdfFromHtml(htmlContent) {
  let browser;
  try {
    // Stage 1: Try launching with explicit environment path
    try {
      console.log("Attempting to launch Puppeteer with explicit environment path...");
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--no-zygote'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      });
    } catch (initialError) {
      console.error("Explicit path failed, triggering automatic local chromium fallback:", initialError.message);
      // Puppeteer reads PUPPETEER_EXECUTABLE_PATH from process.env internally,
      // so we must temporarily clear it to force bundled-chromium discovery via PUPPETEER_CACHE_DIR.
      const savedPath = process.env.PUPPETEER_EXECUTABLE_PATH;
      delete process.env.PUPPETEER_EXECUTABLE_PATH;
      try {
        browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process',
            '--no-zygote'
          ]
        });
        console.log("Fallback Puppeteer launch succeeded.");
      } finally {
        // Restore the env var so other parts of the app aren't affected
        if (savedPath) {
          process.env.PUPPETEER_EXECUTABLE_PATH = savedPath;
        }
      }
    }

    const page = await browser.newPage();

    // networkidle0 ensures all fonts/styles are completely loaded before printing
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // preferCSSPageSize guarantees that your inline CSS margins are respected
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true, // Crucial for background colors/colors to show in PDF
      margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" }
    });

    return pdfBuffer;
  } catch (err) {
    console.error("Puppeteer PDF generation failed:");
    console.error("Error message:", err.message);
    console.error("Full stack:", err.stack);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
  // Enhanced prompt to force beautiful inline CSS styling
  const prompt = `
You are an expert ATS resume writer.

Candidate Resume:
${resume}

Self Description:
${selfDescription}

Target Job Description:
${jobDescription}

Generate a job-tailored resume.

Rules:
- Fit the entire resume on exactly ONE A4 page.
- Keep all sections: Header, Summary, Skills, Projects/Experience, Education, Achievements (if available).
- Shorten content instead of removing important sections.
- Tailor the summary, skills and project descriptions to the job description.
- Use only information provided. Never invent experience, companies, achievements, certifications or education.
- Make the writing natural and professional. Avoid generic AI phrases like "Highly motivated", "Passionate", or "Results-driven".
- Use concise bullet points (maximum 1 line each).
- Return only valid HTML with embedded <style>.
- Use a clean modern layout, Arial/Helvetica font, compact spacing, subtle dividers and professional typography.
- Optimize for both ATS readability and human recruiters.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          // Fixed the schema here to only expect the HTML string!
          html: {
            type: "string",
            description: "Complete HTML code of the resume with embedded CSS styling inside <style> tags."
          }
        },
        required: ["html"]
      }
    }
  });

  const jsonContent = JSON.parse(response.text);

  if (!jsonContent.html) {
    throw new Error("AI failed to generate HTML content for the resume.");
  }

  // Passing the generated HTML string directly to our Puppeteer converter
  const pdfBuffer = await generatePdfFromHtml(jsonContent.html);

  return pdfBuffer;
}

module.exports = { generateInterviewReport, generateResumePdf }