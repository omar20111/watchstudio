import React from 'react';
import {createRoot} from 'react-dom/client';
import {ensureRoundRect} from './core/utils.js';
/* imported for side effects: the invariants run at boot. In dev a broken one
   is fatal; in production it is logged so a user is never shown a blank app
   over a maths regression. */
import {assertReport,assertThrowIfFailed} from './core/assertions.js';
import App from './App.jsx';
import {loadFonts} from './core/markerset/fonts.js';
import './styles.css';

ensureRoundRect();
if(import.meta.env&&import.meta.env.DEV)assertThrowIfFailed();
else{const f=assertReport();if(f.length)console.error('WatchStudio invariants failed:',f)}
/* numerals from PartStudio are measured from its bundled faces: have them first */
loadFonts().finally(()=>createRoot(document.getElementById('root')).render(<App/>));
