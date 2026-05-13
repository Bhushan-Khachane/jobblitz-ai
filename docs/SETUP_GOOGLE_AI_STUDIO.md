# Google AI Studio Setup

Step 1: Go to https://aistudio.google.com
Step 2: Sign in with a Google account
Step 3: Click "Get API Key" -> "Create API Key"
Step 4: Copy the key and paste it into .env as GOOGLE_AI_STUDIO_API_KEY
Step 5: Free tier gives 1,500 requests/day on Gemini 2.0 Flash
         and 50 requests/day on Gemini 2.5 Pro
Step 6: For production, enable billing at
         https://console.cloud.google.com/billing

## Rate limit strategy

- Use Gemini 2.5 Pro only for JD analysis, resume tailoring, fit scoring
- Use Gemini 2.0 Flash for step execution, form-fill planning, verification
- Rotate up to 3 free-tier API keys across users to stay within daily limits
