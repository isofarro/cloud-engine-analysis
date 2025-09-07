import { beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';

// Global test setup
beforeAll(() => {
  // Ensure test directories exist
  const testDirs = ['./tmp', './tmp/test-projects', './tmp/test-state'];

  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
});

// Global test cleanup
afterAll(() => {
  // Clean up test directories
  if (fs.existsSync('./tmp')) {
    fs.rmSync('./tmp', { recursive: true, force: true });
  }
});
