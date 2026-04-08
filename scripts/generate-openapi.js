import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import swaggerSpec from '../src/config/swagger.js';

const outputPath = resolve(process.cwd(), 'openapi.json');

await writeFile(outputPath, `${JSON.stringify(swaggerSpec, null, 2)}\n`, 'utf8');

console.log(`OpenAPI spec written to ${outputPath}`);