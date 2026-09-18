import React from 'react';
import { createRoot } from 'react-dom/client';
import { StudentTabletApp } from './StudentTabletApp';
import './student.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StudentTabletApp />
  </React.StrictMode>
);
