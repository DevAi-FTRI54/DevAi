#!/usr/bin/env python3
"""
DevAI Local API Server for Webapp Integration
Simple FastAPI server that your existing webapp can connect to
"""

import os
import time
import httpx
import asyncio
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
import uvicorn

# Pydantic models for OpenAI-compatible API
class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")

class ChatCompletionRequest(BaseModel):
    model: str = Field(default="devai-assistant", description="Model name")
    messages: List[ChatMessage] = Field(..., description="Conversation messages")
    temperature: Optional[float] = Field(default=0.7, ge=0, le=2)
    max_tokens: Optional[int] = Field(default=2048, ge=1, le=4000)
    stream: Optional[bool] = Field(default=False)

class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]

# Global HTTP client for Ollama
ollama_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global ollama_client
    
    # Startup
    print("🚀 Starting DevAI API Server for Webapp Integration")
    ollama_client = httpx.AsyncClient(base_url="http://localhost:11434", timeout=60.0)
    
    # Check if model is available
    try:
        response = await ollama_client.get("/api/tags")
        if response.status_code == 200:
            models = response.json().get("models", [])
            model_names = [m.get("name") for m in models]
            if "devai-assistant:starcoder" in model_names:
                print("✅ DevAI StarCoder model is available and ready!")
            else:
                print("❌ DevAI StarCoder model not found. Available models:", model_names)
                print("💡 Run: ollama create devai-assistant:starcoder -f /path/to/Modelfile")
    except Exception as e:
        print(f"⚠️ Warning: Could not connect to Ollama: {e}")
        print("💡 Make sure Ollama is running: ollama serve")
    
    yield
    
    # Shutdown
    if ollama_client:
        await ollama_client.aclose()
    print("👋 DevAI API Server stopped")

# Create FastAPI app
app = FastAPI(
    title="DevAI API Server",
    description="Local API server for DevAI model integration with webapp",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for your webapp
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:4000"],  # Your webapp ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        response = await ollama_client.get("/api/tags")
        model_available = False
        
        if response.status_code == 200:
            models = response.json().get("models", [])
            model_names = [m.get("name") for m in models]
            model_available = "devai-assistant:starcoder" in model_names
        
        return {
            "status": "healthy" if model_available else "degraded",
            "model_available": model_available,
            "ollama_connected": response.status_code == 200,
            "timestamp": int(time.time())
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "model_available": False,
            "ollama_connected": False,
            "error": str(e),
            "timestamp": int(time.time())
        }

@app.post("/v1/chat/completions", response_model=ChatCompletionResponse)
async def chat_completions(request: ChatCompletionRequest):
    """OpenAI-compatible chat completions endpoint for your webapp"""
    
    try:
        # Convert messages to prompt format that DevAI understands
        prompt = ""
        for message in request.messages:
            if message.role == "user":
                prompt += f"### Instruction:\n{message.content}\n\n"
            elif message.role == "assistant":
                prompt += f"### Response:\n{message.content}\n\n"
        
        prompt += "### Response:\n"
        
        # Call Ollama API
        ollama_request = {
            "model": "devai-assistant:starcoder",
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens,
            }
        }
        
        print(f"🤖 Processing request: {request.messages[-1].content[:50]}...")
        
        response = await ollama_client.post("/api/generate", json=ollama_request)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Ollama API error: {response.text}"
            )
        
        result = response.json()
        content = result.get("response", "").strip()
        
        print(f"✅ Generated response: {content[:50]}...")
        
        # Return OpenAI-compatible response
        return ChatCompletionResponse(
            id=f"chatcmpl-{int(time.time())}",
            created=int(time.time()),
            model=request.model,
            choices=[{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content
                },
                "finish_reason": "stop"
            }],
            usage={
                "prompt_tokens": len(prompt.split()),
                "completion_tokens": len(content.split()),
                "total_tokens": len(prompt.split()) + len(content.split())
            }
        )
        
    except Exception as e:
        print(f"❌ Error processing request: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.get("/v1/models")
async def list_models():
    """List available models - for compatibility"""
    try:
        response = await ollama_client.get("/api/tags")
        if response.status_code == 200:
            ollama_models = response.json().get("models", [])
            return {
                "object": "list",
                "data": [
                    {
                        "id": model.get("name", "unknown"),
                        "object": "model",
                        "created": int(time.time()),
                        "owned_by": "devai"
                    }
                    for model in ollama_models
                    if "devai" in model.get("name", "")
                ]
            }
    except Exception as e:
        print(f"Error listing models: {e}")
        
    return {
        "object": "list", 
        "data": [{
            "id": "devai-assistant",
            "object": "model", 
            "created": int(time.time()),
            "owned_by": "devai"
        }]
    }

@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "message": "DevAI API Server is running!",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "chat": "/v1/chat/completions",
            "models": "/v1/models"
        },
        "webapp_integration": {
            "base_url": "http://localhost:8080",
            "example_request": {
                "method": "POST",
                "url": "/v1/chat/completions",
                "headers": {"Content-Type": "application/json"},
                "body": {
                    "model": "devai-assistant",
                    "messages": [
                        {"role": "user", "content": "Explain React hooks"}
                    ]
                }
            }
        }
    }

if __name__ == "__main__":
    print("🚀 Starting DevAI API Server for Webapp Integration")
    print("📋 This server will allow your webapp users to access the DevAI model")
    print("")
    print("🔗 API Endpoints:")
    print("   • Health: http://localhost:8080/health")
    print("   • Chat: http://localhost:8080/v1/chat/completions")
    print("   • Models: http://localhost:8080/v1/models")
    print("")
    print("💡 Integration with your webapp:")
    print("   Update your webapp to call: http://localhost:8080/v1/chat/completions")
    print("   Use the same OpenAI-compatible format you're already using")
    print("")
    print("🔄 Starting server...")
    
    uvicorn.run(
        "webapp_api_server:app",
        host="0.0.0.0",
        port=8080,
        reload=False,
        access_log=True
    )
