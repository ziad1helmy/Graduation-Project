#!/usr/bin/env node

/**
 * Generate OpenAPI JSON from YAML
 * Converts openapi.yaml to openapi.json for use with Postman, APIdog, and other tools
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse as parseYAML } from 'yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

try {
  // Read the YAML file
  const yamlPath = join(projectRoot, 'openapi.yaml');
  const yamlContent = readFileSync(yamlPath, 'utf-8');
  
  // Parse YAML to JavaScript object
  const spec = parseYAML(yamlContent);
  
  // Write as JSON
  const jsonPath = join(projectRoot, 'openapi.json');
  writeFileSync(jsonPath, JSON.stringify(spec, null, 2), 'utf-8');
  
  console.log('✓ Generated openapi.json from openapi.yaml');
  console.log(`  → ${jsonPath}`);
} catch (error) {
  console.error('✗ Failed to generate OpenAPI JSON:', error.message);
  process.exit(1);
}
