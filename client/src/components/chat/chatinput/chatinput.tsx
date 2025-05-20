import React, { useEffect, useState } from 'react';
import styles from './chatinput.module.css';

//* Typescript declaration:
interface QueryInputProps {
  setAnswer: (answer: string) => void;
}

//* UX function for expanding text box with context
const autoGrow = (event: React.FormEvent<HTMLTextAreaElement>) => {
  const textarea = event.currentTarget;
  textarea.style.height = 'auto'; //resets height
  textarea.style.height = `${textarea.scrollHeight}px`;
};

const ChatInput: React.FC<QueryInputProps> = ({ setAnswer }) => {
  //* setting up the states
  const [promptText, setPromptText] = useState('');
  const [promptType, setPromptType] = useState<'default' | 'Find' | 'Bugs' | 'Debug' | 'WalkThrough' | 'Services'>(
    'default'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(''); //!check with Marek if this is necessary

  //! check with Marek if this is necessary.
  //* part of session needed for the document
  useEffect(() => {
    const storedSessionID = localStorage.getITem('documentSessionId');
    if (storedSessionID) {
      setSessionId(storedSessionID);
    }
  }, []);

  //* needed for the prompts: sets state for passing
  const handleQuickPrompt = (prompt: string, type: 'Find' | 'Bugs' | 'Debug' | 'WalkThrough' | 'Services') => {
    setPromptText(prompt);
    setPromptType(type);
  };

  //*needed to change the text between the prompts
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPromptText(event.target.value);
  };

  //* needed to handle submit
  const handleSubmit = async () => {
    if (!promptText.trim()) return; //* trim removes any leading or trailing whitespace while checking if there is text or not.

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptText,
          type: promptType,
          sessionId: sessionId,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to submit prompt');
      }
      const data = await response.json();
      console.log('Response ffrom backend:', data);
      setAnswer(data.answer);
    } catch (err) {
      if (err instanceof Error) setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={styles.pageContainer}>
        {/*prettier-ignore*/}
        <div className={styles.buttonContainer}>
            <div className={styles.btns}>
              <button onClick={ () => handleQuickPrompt("Find and explain the logic for the following:", 'Find')}>Find & Explain</button>
              <button onClick={ () => handleQuickPrompt("What are the most common bugs or pitfalls in this repo?", 'Bugs')}>Common Bugs</button>
              <button onClick={ () => handleQuickPrompt("Where do I start to debug this type of problem?", 'Debug')}>Debug</button>
              <button onClick={ () => handleQuickPrompt("Walk me through the data flow for ...", 'WalkThrough')}>Walkthrough</button>
              <button onClick={ () => handleQuickPrompt("List all the third-party services used in this repo", 'Services')}>Services</button>
            </div>
         </div>
        <div className={styles.textBoxContainer}>
          <textarea
            className={styles.textBox}
            placeholder="Please type your prompt here"
            value={promptText}
            onChange={handleChange}
            onInput={autoGrow}
            rows={6}
          />
        </div>
        <button className={styles.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Submitting...' : 'Submit'}
        </button>

        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    </>
  );
};

export default ChatInput;
