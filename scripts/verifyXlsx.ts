declare function require(id: string): { writeFileSync(path: string, data: Uint8Array): void };

import { buildXlsxReport } from '../src/xrd/export/exportXlsx';
import { createSampleState } from '../src/xrd/project/projectSchema';
import type { SampleState } from '../src/xrd/types';

const parsed = {
  points: [{ x: 2, y: 100 }, { x: 15, y: 10 }],
  metadata: { sourceFormat: 'txt' as const },
};

function sample(index: number): SampleState {
  const created = createSampleState({
    sampleId: `sample-${index}`,
    gl: { fileName: `sample-${index}.il.gl.txt`, parsed },
  });
  if (!created) throw new Error('Test sample creation');
  return {
    ...created,
    result: {
      smectiteIS: 10 + index,
      illite: 20 + index,
      chlorite: 30 - index,
      kaolinite: 40 - index,
      chloriteKaolinite: 70 - index * 2,
      total: 100,
    },
  };
}

async function verify(): Promise<void> {
  const data = await buildXlsxReport([sample(1), sample(2), sample(3)]);
  if (!data) throw new Error('XLSX report was not built');
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(data, { type: 'array' });
  if (workbook.SheetNames.join('|') !== 'Biscaye|Профили') throw new Error('XLSX worksheets');

  const archive = XLSX.CFB.read(new Uint8Array(data), { type: 'buffer' }) as { FullPaths: string[]; FileIndex: { content?: Uint8Array }[] };
  if (new Set(archive.FullPaths).size !== archive.FullPaths.length) throw new Error('Duplicate XLSX archive parts');
  const chartPaths = archive.FullPaths.filter((path) => /\/xl\/charts\/chart\d+\.xml$/.test(path));
  if (chartPaths.length !== 1) throw new Error(`Expected one mineral chart, received ${chartPaths.length}`);
  const sheetPath = archive.FullPaths.find((path) => path.endsWith('/xl/worksheets/sheet2.xml'));
  if (!sheetPath) throw new Error('Profiles worksheet XML');
  const sheetIndex = archive.FullPaths.indexOf(sheetPath);
  const sheetXml = new TextDecoder().decode(archive.FileIndex[sheetIndex].content);
  if (sheetXml.indexOf('</ignoredErrors>') > sheetXml.indexOf('<drawing ')) throw new Error('Drawing must follow ignoredErrors in worksheet XML');
  for (const path of chartPaths) {
    const index = archive.FullPaths.indexOf(path);
    const xml = new TextDecoder().decode(archive.FileIndex[index].content);
    if (!xml.includes('<c:min val="0"/>') || !xml.includes('<c:orientation val="maxMin"/>')) throw new Error(`Chart axes: ${path}`);
    if ((xml.match(/<c:ser>/g) ?? []).length !== 4) throw new Error('Expected four mineral series in the chart');
  }

  const fs = require('node:fs');
  fs.writeFileSync('node_modules/.tmp/verified-report.xlsx', new Uint8Array(data));
  console.log('XLSX mineral profile charts passed');
}

void verify();
