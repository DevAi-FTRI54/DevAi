import React, { useState } from 'react';
import type { UserSettingsProps } from '../../types';

const UserSettings: React.FC<UserSettingsProps> = ({ apiKey: initialKey = '', onSave }) => {
  const [apiKey, setApiKey] = useState(initialKey);
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    if (onSave) onSave(apiKey);
  };

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>User Settings</h2>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>OpenAI API Key</label>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ flex: 1, marginRight: 8 }}
            autoComplete="off"
            spellCheck="false"
          />
          <button type="button" onClick={() => setShowKey((v) => !v)}>
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <button onClick={handleSave} style={{ marginRight: 8 }}>
        Save
      </button>
      {/* Optionally: <button onClick={() => setApiKey('')}>Clear</button> */}
    </div>
  );
};

export default UserSettings;
