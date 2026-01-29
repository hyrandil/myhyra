import { createRoot } from 'react-dom/client';
import { TerminalApp } from './terminal';
import './styles.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<TerminalApp />);
}
