require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 8080;
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 18 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.split(";")[0].trim().toLowerCase();
    console.log("RECORDING FORMAT:", file.mimetype);

    const allowed = [
      "video/webm",
      "video/mp4",
      "video/quicktime",
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav"
    ];

    if (allowed.includes(mime)) {
      cb(null, true);
    } else {
      cb(new Error("Please upload a WEBM, MP4, MOV, MP3 or WAV recording."));
    }
  }
});
app.use("/api/analyze", (req, res, next) => {
  console.log("ANALYZE REQUEST RECEIVED");
  next();
});
app.get("/api/health", (_req,res) => res.json({ ok:true, aiConfigured: Boolean(process.env.GEMINI_API_KEY), app:"SpeakSense" }));

const analysisPrompt = `You are SpeakSense, a supportive evidence-based communication coach. Analyse the provided user's short speaking recording.
Return ONLY valid JSON with this exact shape:
{
 "overallScore": number from 0 to 100,
 "headline": "one encouraging sentence",
 "summary": "2-3 sentences, specific and kind",
 "metrics": {
   "pace": {"score":0-100,"label":"...","detail":"..."},
   "clarity": {"score":0-100,"label":"...","detail":"..."},
   "fillerWords": {"score":0-100,"label":"...","detail":"..."},
   "structure": {"score":0-100,"label":"...","detail":"..."},
   "delivery": {"score":0-100,"label":"...","detail":"..."}
 },
 "strengths": ["...","..."],
 "improvements": [{"title":"...","why":"...","exercise":"..."}],
 "practicePlan": [{"day":"Today","task":"...","duration":"5 min"}],
 "transcriptHighlights": ["..."],
 "coachNote": "A warm, motivating closing note"
}
Rules:
- Score only what is observable/audible. Do not infer personality, intelligence, confidence, mental health, or internal emotions from appearance.
- For audio-only recordings, set delivery detail to "Not assessed from audio-only recording" and score delivery as null.
- Do not claim precise eye-contact or body-language measurements unless clearly observable in the video.
- Be specific; quote short filler words or phrases only when audible.
- If the recording is too short or unclear, say so and recommend a retake; do not invent observations.
- Make feedback practical, respectful, non-judgmental, and suitable for a beginner.
- The user may be practising a presentation, interview, or conversation. Analyse the communication, not the topic's factual correctness.`;

function parseJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const first = cleaned.indexOf("{"), last = cleaned.lastIndexOf("}");
  if (first < 0 || last < first) throw new Error("The AI returned an unreadable response. Please try again.");
  return JSON.parse(cleaned.slice(first, last + 1));
}

app.post("/api/analyze", upload.single("recording"), async (req,res) => {
  try {
    const context = (req.body.context || "General speaking practice").slice(0,160);
    if (!req.file) return res.status(400).json({ error:"Please record or upload a video/audio clip first." });
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes("PASTE_")) {
      return res.status(503).json({ error:"AI is not configured yet. Add your Gemini API key to the .env file and restart SpeakSense." });
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model:"gemini-3.5-flash-lite", generationConfig:{ responseMimeType:"application/json", temperature:0.35 } });
    const prompt = `${analysisPrompt}\nPractice context: ${context}`;
    console.log("Sending recording to Gemini...");
    let result;

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    result = await model.generateContent([
      { inlineData: { mimeType: req.file.mimetype, data: req.file.buffer.toString("base64") } },
      { text: prompt }
    ]);
    break;
  } catch (err) {
    if (!err.message.includes("503") || attempt === 3) throw err;

    console.log(`Gemini busy. Retrying: ${attempt}/3`);
    await new Promise(resolve => setTimeout(resolve, attempt * 5000));
  }
}
    console.log("Gemini response received!");
    const analysis = parseJson(result.response.text());
    res.json({ analysis, source:"gemini" });
  } catch (err) {
    console.error("Analysis error:", err.message);
    res.status(500).json({ error: err.message || "Analysis failed. Please try again." });
  }
});
 app.post("/api/session", async (req, res) => {
  try {
    const { goal="Speak more clearly", level="Beginner", context="College presentation" } = req.body || {};
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes("PASTE_")) return res.status(503).json({ error:"Add your Gemini API key to .env to generate a personalised practice session." });
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model:"gemini-3.5-flash-lite", generationConfig:{ responseMimeType:"application/json", temperature:0.6 } });
    const prompt = `Create a practical 5-minute communication practice session. Goal: ${String(goal).slice(0,120)}. Level: ${String(level).slice(0,40)}. Context: ${String(context).slice(0,120)}. Return JSON: {"title":"...","encouragement":"...","steps":[{"name":"...","minutes":1,"instruction":"...","prompt":"..."}],"reflectionQuestion":"..."}. Make it supportive, specific and beginner-friendly. Do not make medical claims.`;
    const result = await model.generateContent(prompt);
    res.json({ session:parseJson(result.response.text()) });
  } catch(err) { res.status(500).json({ error:err.message || "Could not create practice session." }); }
});

app.get("*", (_req,res) => res.sendFile(require("path").join(__dirname,"public","index.html")));
app.use((err, req, res, next) => {
  console.error("UPLOAD ERROR:", err);
  res.status(400).json({ error: err.message || "Request error" });
});
app.listen(PORT, () => console.log(`SpeakSense running on http://localhost:${PORT}`));
