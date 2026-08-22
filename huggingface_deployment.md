# Deploying the Backend to Hugging Face Spaces

Hugging Face Spaces provides a free 16GB RAM tier (via their Docker Spaces), which completely solves the memory issues you experienced on Render.

I have already created the `Dockerfile` for you. Follow these steps to get your backend running on Hugging Face:

### Step 1: Push the new Dockerfile to GitHub
In your terminal, run:
```bash
git add Dockerfile
git commit -m "feat: Add Dockerfile for Hugging Face Spaces deployment"
git push origin main
```

### Step 2: Create the Hugging Face Space
1. Go to [Hugging Face Spaces](https://huggingface.co/spaces) and log in.
2. Click **Create new Space**.
3. Fill in the details:
   - **Space name**: `ragingoa-backend` (or whatever you prefer)
   - **License**: Choose your preference (e.g., MIT or leave empty)
   - **Select the Space SDK**: Choose **Gradio**.
   - **Space Hardware**: **Free** (2 vCPU, 16GB RAM).
4. Click **Create Space**.

### Step 3: Link your GitHub Repository
Now we need to pull your code into the Space.
1. Once your Space is created, go to the **Settings** tab.
2. Scroll down to **Variables and secrets**. This is where we will put your `.env` keys.
3. Add the following **New Secrets**:
   - `GROQ_API_KEY`: Your Groq API Key
   - `SARVAM_API_KEY`: Your Sarvam API Key
   - `DATABASE_URL`: Your Neon PostgreSQL Connection String
4. Scroll back to the top of the **Settings** tab and look for **Build from GitHub**.
5. Connect your GitHub account (if not already connected) and select your `RAGInGOA` repository. 
6. Select the `main` branch.
7. Click **Deploy**.

Hugging Face will automatically find the `Dockerfile` we created, build the image, and start your FastAPI server! You can click on the "Logs" button to watch it install the dependencies and download the ML models.

### Step 4: Update the Frontend
Once your Space is running, it will have a URL like:
`https://yourusername-ragingoa-backend.hf.space`

Go to your Vercel Dashboard, select your Frontend project, go to **Settings > Environment Variables**, and update `VITE_API_BASE_URL` to point to your new Hugging Face Space URL. Redeploy the frontend in Vercel, and you are done!
