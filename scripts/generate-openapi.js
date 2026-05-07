import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import YAML from 'yaml';
import swaggerSpec from '../src/config/swagger.js';

const jsonOutputPath = resolve(process.cwd(), 'openapi.json');
const yamlOutputPath = resolve(process.cwd(), 'openapi.yaml');

await writeFile(jsonOutputPath, `${JSON.stringify(swaggerSpec, null, 2)}\n`, 'utf8');
await writeFile(yamlOutputPath, `${YAML.stringify(swaggerSpec)}\n`, 'utf8');

console.log(`OpenAPI spec written to ${jsonOutputPath}`);
console.log(`OpenAPI spec written to ${yamlOutputPath}`);