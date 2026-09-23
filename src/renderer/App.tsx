import React, { useState } from 'react';
import { ChatPage } from './pages/Chat';
import { SkillsPage } from './pages/Skills';
import { FilesPage } from './pages/Files';
import { SettingsPage } from './pages/Settings';

function App() {
  const [page, setPage] = useState('chat');

  const renderPage = () => {
    switch (page) {
      case 'skills': return <SkillsPage />;
      case 'files': return <FilesPage />;
      case 'settings': return <SettingsPage />;
      default: return <ChatPage />;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Ayesh</h1>
        <nav>
          <a href="#" onClick={() => setPage('chat')}>Chat</a>
          <a href="#" onClick={() => setPage('skills')}>Skills</a>
          <a href="#" onClick={() => setPage('files')}>Files</a>
          <a href="#" onClick={() => setPage('settings')}>Settings</a>
        </nav>
      </header>
      <main>{renderPage()}</main>
    </div>
  );
}

export default App;
