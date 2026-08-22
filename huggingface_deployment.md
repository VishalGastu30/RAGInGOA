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

### Step 3: Link your GitHub Repository (Using GitHub Actions)
Hugging Face recently removed the "Build from GitHub" button, so we will use a **GitHub Action** to automatically deploy your code from GitHub to Hugging Face whenever you push!

1. Go to your [Hugging Face Settings -> Access Tokens](https://huggingface.co/settings/tokens).
2. Create a new token with **Write** access and copy it.
3. Go to your **GitHub Repository** -> **Settings** -> **Secrets and variables** -> **Actions**.
4. Click **New repository secret**. 
5. Name it `HF_TOKEN` and paste your Hugging Face token as the value.

Once you have done that, I will generate a GitHub Action file for you that will automatically sync your GitHub code to Hugging Face. Let me know when you have added the `HF_TOKEN` secret to GitHub!
Hugging Face will automatically find the `Dockerfile` we created, build the image, and start your FastAPI server! You can click on the "Logs" button to watch it install the dependencies and download the ML models.

### Step 4: Update the Frontend
Once your Space is running, it will have a URL like:
`https://yourusername-ragingoa-backend.hf.space`

Go to your Vercel Dashboard, select your Frontend project, go to **Settings > Environment Variables**, and update `VITE_API_BASE_URL` to point to your new Hugging Face Space URL. Redeploy the frontend in Vercel, and you are done!
