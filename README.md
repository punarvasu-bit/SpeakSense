# SpeakSense — Your Personal AI Communication Coach

SpeakSense is a web application for communication practice. Users can record or upload a short speaking clip, receive AI-generated feedback, and create personalised five-minute practice sessions.

## Features
- Record audio/video in the browser or upload a supported clip.
- Gemini-powered multimodal communication feedback.
- Feedback on pace, clarity, filler words, structure and observable delivery.
- Personalised practice session generator.
- Local progress history stored in the browser.
- Responsive, polished dashboard.

## Tech stack
Node.js, Express, Google Gemini 2.5 Flash, HTML, CSS and JavaScript.

## Run locally
1. Install Node.js 20 or later.
2. Open this folder in a terminal.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Add your Gemini API key to `.env`:
   `GEMINI_API_KEY=your_key_here`
6. Run `npm start`.
7. Open `http://localhost:8080`.

Get a Gemini API key from https://aistudio.google.com/app/apikey. Never commit `.env` or share your API key.

## Deploy to Google Cloud Run
1. Create/select a Google Cloud project and enable billing.
2. Enable Cloud Run and Cloud Build APIs.
3. Install and authenticate the Google Cloud CLI.
4. From this project folder, deploy:
   `gcloud run deploy speaksense --source . --region asia-south1 --allow-unauthenticated --set-env-vars GEMINI_API_KEY=YOUR_KEY`
5. For a production deployment, store the API key in Secret Manager rather than putting it in a command or source file.

The app listens on the `PORT` environment variable, defaulting to 8080.

## Privacy and limitations
- Recordings are sent to the configured Gemini API only when the user selects Analyse.
- The application does not write recordings to disk or retain them on its server.
- Progress history is stored locally in the user's browser.
- Feedback is coaching guidance, not a validated psychological assessment. A video cannot reliably reveal internal confidence, personality or mental state.
- Audio/video uploads are limited to 18 MB in this starter build. Browser recording requires camera/microphone permission and a secure context (localhost or HTTPS).

## Challenge alignment
**PS04 — Personalised AI Learning Agent.** SpeakSense follows an assess → identify → personalise → practise → review learning loop.
