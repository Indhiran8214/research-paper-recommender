# 📚 AI Research Paper Recommender

An AI-powered web application that searches millions of scholarly papers and uses GPT-4o to rank and surface the **top 5 most relevant research papers** for any topic.

---

## 🏗️ Architecture

```
User → Frontend (HTML/CSS/JS) → Express Backend → Semantic Scholar API
                                              ↓
                                         OpenAI GPT-4o (ranking)
                                              ↓
                                    Top 5 papers returned to UI
```

---

## 📁 Project Structure

```
/research-paper-recommender
├── /public
│   ├── index.html        ← Homepage with hero + search bar
│   ├── results.html      ← Results page with paper cards
│   ├── style.css         ← Full custom styling (no frameworks)
│   └── script.js         ← Frontend logic (search, render, API calls)
├── /server
│   ├── server.js         ← Express app entry point
│   ├── routes.js         ← API route: POST /api/search
│   ├── paperService.js   ← Fetches papers from Semantic Scholar
│   └── aiRankingService.js ← Ranks papers via OpenAI GPT-4o
├── .env                  ← Environment variables (API keys)
└── package.json
```

---

## ⚡ Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

Edit the `.env` file:

```env
OPENAI_API_KEY=sk-...your-openai-key...
PORT=3000
SEMANTIC_SCHOLAR_API_KEY=   # optional, but recommended
```

**Get your API keys:**
- **OpenAI**: https://platform.openai.com/api-keys
- **Semantic Scholar** (optional, improves rate limits): https://www.semanticscholar.org/product/api

### 3. Start the Server

```bash
node server/server.js
```

Or with auto-reload during development:

```bash
npm run dev
```

### 4. Open in Browser

```
http://localhost:3000
```

---

## 🔌 API Endpoints

| Method | Endpoint       | Description                             |
|--------|----------------|-----------------------------------------|
| POST   | `/api/search`  | Search and rank papers for a query      |
| GET    | `/api/health`  | Health check — shows API key status     |

### POST /api/search

**Request body:**
```json
{ "query": "fake news detection using deep learning" }
```

**Response:**
```json
{
  "papers": [
    {
      "title": "Detecting Fake News with BERT",
      "year": 2023,
      "summary": "This paper proposes a transformer-based model...",
      "reason": "Highly cited paper directly addressing the query topic.",
      "citations": 340,
      "link": "https://arxiv.org/abs/...",
      "authors": "Smith J., Lee A. et al.",
      "venue": "ACL 2023"
    }
  ],
  "query": "fake news detection using deep learning",
  "totalFetched": 15
}
```

---

## 🚀 Deploying to Render

1. Push this project to a GitHub repository.
2. Go to [Render.com](https://render.com) → **New Web Service**.
3. Connect your GitHub repo.
4. Set the following:
   - **Build Command**: `npm install`
   - **Start Command**: `node server/server.js`
   - **Root Directory**: (leave blank)
5. Add **Environment Variables** in Render dashboard:
   - `OPENAI_API_KEY`
   - `SEMANTIC_SCHOLAR_API_KEY` (optional)
   - `PORT` (Render sets this automatically)

---

## 🛠️ Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | HTML5, CSS3, Bootstrap 5, Vanilla JS |
| Backend   | Node.js, Express.js                  |
| Paper API | Semantic Scholar Graph API           |
| AI Model  | OpenAI GPT-4o-mini                   |
| Fonts     | Playfair Display, DM Sans (Google)   |
| Icons     | Font Awesome 6                       |

---

## 💡 Suggested Search Topics

- Fake news detection
- Large Language Models
- Federated Learning
- IoT Security
- Quantum Computing
- Computer Vision
- Cybersecurity
- Data Science
- Transformer architectures
- Reinforcement Learning from Human Feedback

---

## 📝 Notes

- The Semantic Scholar API is **free** and requires no key for basic usage (rate limits apply).
- Results may vary depending on Semantic Scholar's index for very new or niche topics.
- The OpenAI key is billed per use; typical searches cost <$0.01 with GPT-4o-mini.
