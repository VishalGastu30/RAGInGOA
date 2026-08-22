import gradio as gr
from backend.app.main import app as fastapi_app

def status():
    return "RAG Backend is running successfully! Frontend should connect to /api/ask"

# Create a simple Gradio interface so Hugging Face Spaces recognizes it as healthy
demo = gr.Interface(
    fn=status, 
    inputs=None, 
    outputs="text", 
    title="RAG Backend Status",
    description="This Space hosts the FastAPI backend for the Voice RAG system."
)

# Mount the FastAPI app inside the Gradio app
# Gradio will serve at "/" and FastAPI routes like "/api/health" will be preserved.
app = gr.mount_gradio_app(fastapi_app, demo, path="/")
