import { readFileSync } from 'fs';
import { parse as parseYAML } from 'yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Resolve absolute path to openapi.yaml
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const yamlPath = join(__dirname, '../../openapi.yaml');
const yamlContent = readFileSync(yamlPath, 'utf-8');

export const swaggerSpec = parseYAML(yamlContent);
export default swaggerSpec;
