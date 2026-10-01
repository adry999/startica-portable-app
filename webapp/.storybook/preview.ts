import type { Preview } from '@storybook/react-vite';
import '../src/shared/tokens/tokens.css';

const VIEWPORTS = {
  d1440: { name: '1440', styles: { width: '1440px', height: '900px' } },
  d1024: { name: '1024', styles: { width: '1024px', height: '768px' } },
  d768: { name: '768', styles: { width: '768px', height: '1024px' } },
  d390: { name: '390', styles: { width: '390px', height: '844px' } },
};

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'cream',
      values: [
        { name: 'cream', value: 'var(--cream)' },
        { name: 'white', value: 'var(--white)' },
      ],
    },
    viewport: { viewports: VIEWPORTS, defaultViewport: 'd1440' },
    a11y: { test: 'error' },
  },
};

export default preview;
