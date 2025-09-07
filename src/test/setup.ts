import { beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Global test setup
beforeAll(() => {
  // Ensure persistent test base directories exist
  const testDirs = [
    './tmp',
    './tmp/test-projects', // Persistent base for ProjectManager tests
    './tmp/test-integration', // Persistent base for integration tests
    './tmp/test-state',
  ];

  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
});

// Global test cleanup - PRESERVE base directories, clean only contents
afterAll(() => {
  // Clean up test directory contents but preserve the base structure
  const baseDirsToClean = ['./tmp/test-projects', './tmp/test-integration'];

  baseDirsToClean.forEach(baseDir => {
    if (fs.existsSync(baseDir)) {
      try {
        const contents = fs.readdirSync(baseDir);
        for (const item of contents) {
          const itemPath = path.join(baseDir, item);
          try {
            // Remove all test subdirectories but preserve the base directory
            fs.rmSync(itemPath, { recursive: true, force: true });
          } catch (error) {
            console.warn(`Failed to clean up ${itemPath}:`, error);
          }
        }
      } catch (error) {
        console.warn(`Failed to read ${baseDir}:`, error);
      }
    }
  });

  // Clean up other test-related items in ./tmp (but preserve base dirs)
  if (fs.existsSync('./tmp')) {
    try {
      const tmpContents = fs.readdirSync('./tmp');
      for (const item of tmpContents) {
        // Skip the persistent base directories
        if (
          item === 'test-projects' ||
          item === 'test-integration' ||
          item === 'test-state'
        ) {
          continue;
        }

        const itemPath = path.join('./tmp', item);
        try {
          // Only remove other test-related directories
          if (item.startsWith('test-') || item.includes('test')) {
            fs.rmSync(itemPath, { recursive: true, force: true });
          }
        } catch (error) {
          console.warn(`Failed to clean up ${itemPath}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to read ./tmp directory:', error);
    }
  }
});
