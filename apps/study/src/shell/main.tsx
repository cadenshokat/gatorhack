// The study shell: the onboarding's tokens and flow styles, then the study's own phone layout.
import '../../../extension/entrypoints/fitting/ui/tokens.css';
import '../../../extension/entrypoints/fitting/flow.css';
import '../styles/study.css';
import { render } from 'preact';
import { App } from './App';

render(<App />, document.getElementById('app')!);
