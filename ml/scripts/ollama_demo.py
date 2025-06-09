#!/usr/bin/env python3
"""
Ollama Local Demo Script
Test your conversation flow with base models before fine-tuning
"""

import requests
import json
import sys
from typing import List, Dict

class OllamaDemo:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        
    def list_models(self) -> List[str]:
        """List available Ollama models"""
        try:
            response = requests.get(f"{self.base_url}/api/tags")
            if response.status_code == 200:
                models = response.json().get('models', [])
                return [model['name'] for model in models]
            return []
        except Exception as e:
            print(f"❌ Error connecting to Ollama: {e}")
            print("💡 Make sure Ollama is running: ollama serve")
            return []
    
    def chat(self, model: str, messages: List[Dict], stream: bool = True) -> str:
        """Chat with Ollama model"""
        try:
            payload = {
                "model": model,
                "messages": messages,
                "stream": stream
            }
            
            response = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                stream=stream
            )
            
            if stream:
                full_response = ""
                for line in response.iter_lines():
                    if line:
                        chunk = json.loads(line.decode('utf-8'))
                        if 'message' in chunk:
                            content = chunk['message'].get('content', '')
                            print(content, end='', flush=True)
                            full_response += content
                print()  # New line after streaming
                return full_response
            else:
                result = response.json()
                return result['message']['content']
                
        except Exception as e:
            return f"❌ Error: {e}"
    
    def test_code_understanding(self, model: str):
        """Test model's code understanding capabilities"""
        print(f"\n🧪 Testing {model} with code understanding...")
        
        test_messages = [
            {
                "role": "system",
                "content": "You are DevAI Assistant, a helpful coding assistant. Provide clear, concise explanations about code."
            },
            {
                "role": "user", 
                "content": """Explain this React component:

```jsx
function UserProfile({ user, onEdit }) {
  const [editing, setEditing] = useState(false);
  
  return (
    <div className="profile">
      {editing ? (
        <EditForm user={user} onSave={() => setEditing(false)} />
      ) : (
        <div>
          <h2>{user.name}</h2>
          <button onClick={() => setEditing(true)}>Edit</button>
        </div>
      )}
    </div>
  );
}
```"""
            }
        ]
        
        response = self.chat(model, test_messages, stream=True)
        return response
    
    def test_conversation_context(self, model: str):
        """Test model with conversation context (like your fine-tuned model will have)"""
        print(f"\n💬 Testing {model} with conversation context...")
        
        # Simulate a conversation history like your MongoDB data
        messages = [
            {"role": "system", "content": "You are DevAI Assistant, a helpful coding assistant specialized in helping developers understand their codebase."},
            {"role": "user", "content": "I'm looking at this function in my React app but I'm not sure what it does."},
            {"role": "assistant", "content": "I'd be happy to help explain the function! Could you please share the code so I can analyze it for you?"},
            {"role": "user", "content": "Here it is:\n\nfunction processUserData(users) {\n  return users.filter(u => u.active).map(u => ({ ...u, displayName: `${u.firstName} ${u.lastName}` }));\n}"},
        ]
        
        response = self.chat(model, messages, stream=True)
        return response

    def test_with_citations_format(self, model: str):
        """Test how model handles citation-like responses"""
        print(f"\n📚 Testing {model} with citation format...")
        
        messages = [
            {"role": "system", "content": "You are DevAI Assistant. When explaining code, reference specific files and line numbers when possible."},
            {"role": "user", "content": "How does authentication work in this codebase?"},
            {"role": "assistant", "content": "Based on the codebase structure, authentication appears to work through:\n\n1. JWT tokens handled in `server/src/middleware/authMiddleware.ts`\n2. GitHub OAuth integration in `server/src/features/auth/`\n3. Cookie-based session management\n\nThe main auth flow:\n- User authenticates via GitHub\n- JWT token stored in HTTP-only cookie\n- Middleware validates token on protected routes\n\nReferences:\n- authMiddleware.ts (lines 15-30): Token validation logic\n- auth.controller.ts (lines 45-60): GitHub OAuth callback"},
            {"role": "user", "content": "Can you show me how to add a new protected route?"}
        ]
        
        response = self.chat(model, messages, stream=True)
        return response

def main():
    """Main demo function"""
    print("🚀 Ollama Local Demo - DevAI Assistant Testing")
    print("=" * 60)
    
    # Initialize Ollama client
    ollama = OllamaDemo()
    
    # Check available models
    print("📋 Checking available models...")
    models = ollama.list_models()
    
    if not models:
        print("❌ No models found. Please install a model first:")
        print("   ollama pull llama2:7b-chat")
        print("   ollama pull codellama:7b")
        print("   ollama pull mistral:7b")
        return
    
    print(f"✅ Found {len(models)} models:")
    for i, model in enumerate(models, 1):
        print(f"   {i}. {model}")
    
    # Use the first chat model (prefer ones with 'chat' in name)
    chat_models = [m for m in models if 'chat' in m.lower()]
    demo_model = chat_models[0] if chat_models else models[0]
    
    print(f"\n🎯 Using model: {demo_model}")
    print(f"💡 This simulates how your fine-tuned 'devai-assistant' model will work")
    
    # Test code understanding
    ollama.test_code_understanding(demo_model)
    print("\n" + "="*60)
    
    # Test conversation context
    ollama.test_conversation_context(demo_model)
    print("\n" + "="*60)
    
    # Test citation format
    ollama.test_with_citations_format(demo_model)
    print("\n" + "="*60)
    
    print("✅ Demo complete!")
    print("\n💡 Next steps:")
    print("   1. Export your conversation data: GET /api/training/export-data")
    print("   2. Fine-tune on RunPod with your data")
    print("   3. Load fine-tuned model: ollama create devai-assistant -f ./Modelfile")
    print("   4. Replace this demo with: ollama run devai-assistant")

if __name__ == "__main__":
    main()
